const { validateAppName } = require('./acl');
const { getNamespace, getConfigMap } = require('./get');

async function getEnv(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found.');
    }

    const configMap = await getConfigMap(k8s, namespace);
    if (configMap === null) {
        ctx.body = { env: {} };
        return;
    }

    const env = {};
    if (configMap.data.vars !== undefined) {
        const vars = JSON.parse(configMap.data.vars);
        for (const [key, value] of Object.entries(vars)) {
            env[key] = value;
        }
    }

    ctx.body = { env };
}

async function setEnv(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found.');
    }

    const { key = '', value = '' } = ctx.request.body;
    if (key === '') {
        ctx.throw(400, '`key` is required.');
    }

    if (value === '' || (value instanceof Object && Object.keys(value).length === 0)) {
        ctx.throw(400, '`value` is required.');
    }

    // get config map
    const origConfigMap = await getConfigMap(k8s, namespace);
    let data = {};
    let op = 'post';
    if (origConfigMap !== null) {
        data = origConfigMap.data;
        op = 'patch';
    }

    const vars = data.vars !== undefined ? JSON.parse(data.vars) : {};
    vars[key] = value;
    data.vars = JSON.stringify(vars);

    const configMap = {
        kind: 'ConfigMap',
        metadata: {
            name: 'env',
            namespace: namespace.metadata.name,
        },
        data
    };

    if (op === 'post') {
        await k8s.api.v1.namespaces(namespace.metadata.name)
            .configmaps
            .post({ body: configMap });
    } else {
        await k8s.api.v1.namespaces(namespace.metadata.name)
            .configmaps('env')
            .patch({ body: configMap });
    }

    ctx.body = { env: vars };
}

module.exports = { getEnv, setEnv };
