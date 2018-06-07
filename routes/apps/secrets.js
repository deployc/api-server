const { validateAppName } = require('./acl');
const { getNamespace, getConfigMap } = require('./get');

async function getSecrets(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found.');
    }

    const { body: { items: secrets } } = await k8s.api.v1
        .namespaces(namespace.metadata.name)
        .secrets
        .get({
            qs: {
                sortBy: '{.metadata.creationTimestamp}'
            }
        });

    ctx.body = {
        secrets: secrets
            .filter(s => s.type === 'Opaque')
            .map(s => ({
                'name': s.metadata.name,
                'type': s.metadata.labels.type,
                'createdAt': s.metadata.creationTimestamp,
            }))
    }
}

async function createSecret(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    const { name = '', value = '', type = '' } = ctx.request.body;
    if (name === '') {
        ctx.throw(400, '`name` is required.');
    }

    if (value === '' && Object.keys(value).length === 0) {
        ctx.throw(400, '`value` is required.');
    }

    if (type === '') {
        ctx.throw(400, '`type` is required.');
    }

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found.');
    }

    let data;
    if (type === 'credentials') {
        const { username, password } = value;
        data = { username, password };
    } else if (type === 'certificate') {
        data = { 'tls.key': value['tls.key'], 'tls.cert': value['tls.cert'] };
    } else if (type === 'raw') {
        data = { value }
    } else {
        ctx.throw(400, 'Expected \'certificate\', \'credentials\', or \'raw\' for `type`');
    }

    const secret = {
        kind: 'Secret',
        type: 'Opaque',
        metadata: {
            name,
            namespace: namespace.metadata.name,
            labels: { type }
        },
        data
    }

    await k8s.api.v1
        .namespaces(namespace.metadata.name)
        .secrets
        .post({ body: secret });

    ctx.body = { name, type, createdAt: new Date() }
}

module.exports = { getSecrets, createSecret };
