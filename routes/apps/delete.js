const { getNamespace } = require('./get');
const { validateAppName } = require('./acl');

async function deleteNamespace(k8s, namespace) {
    await k8s.api.v1.namespaces(namespace).delete({
        body: {
            propagationPolicy: 'Foreground'
        }
    });
}

async function deleteApp(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, `Could not find app ${appName}`);
    }

    await deleteNamespace(k8s, namespace.metadata.name);
    ctx.body = { message: `Deleted ${namespace.metadata.name}` };
}

module.exports = { deleteNamespace, deleteApp };
