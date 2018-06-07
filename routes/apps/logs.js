const { validateAppName } = require('./acl');
const { getNamespace, getPods } = require('./get');
const { MemoryReadableStream, PrefixedStream } = require('../../utils/memory_stream');

async function logs(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    let { tail, follow='0' } = ctx.request.query;
    follow = follow === '1' || follow === 'true';

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found');
    }

    const qs = {
        follow,
        timestamps: true
    };

    if (tail !== undefined) {
        qs.tailLines = parseInt(tail);
    }

    const pods = await getPods(k8s, namespace);
    const streams = pods.map(pod => [
        pod,
        k8s.api.v1
            .namespaces(namespace.metadata.name)
            .pods(pod.metadata.name)
            .log.getStream({ qs })
    ]);

    const body = new MemoryReadableStream();
    ctx.body = body;

    let openStreams = streams.length;
    for (const [pod, stream] of streams) {
        stream.on('data', chunk => {
            if (!chunk) {
                return;
            }

            // note: trimEnd so we don't get the last '\n'
            const lines = chunk.toString().trimEnd().split('\n');
            for (const line of lines) {
                body.push(`${pod.metadata.labels.service}|`);
                body.push(line);
                body.push('\n');
            }
        });

        stream.on('end', () => {
            openStreams -= 1;
            if (openStreams === 0) {
                body.push(null);
            }
        });
    }

    // write out a PING if we're following so we don't lose connection
    if (follow) {
        const ping = setInterval(() => {
            if (openStreams === 0) {
                clearInterval(ping);
                return;
            }
            body.push('PING\n');
        }, 5000);
    }
}

module.exports = { logs };
