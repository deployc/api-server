async function getNamespace(k8s, user, appName) {
    const { body: { items: namespaces } } = await k8s.api.v1.namespaces.get({
        qs: {
            labelSelector: `user=${user},appName=${appName}`
        }
    });

    if (namespaces.length !== 0 && namespaces[0].metadata.labels.initialized === 'true') {
        return namespaces[0];
    }

    return null;
}

async function getConfigMap(k8s, namespace) {
    try {
        const { body } = await k8s.api.v1
            .namespaces(namespace.metadata.name)
            .configmaps('env')
            .get();
        return body;
    } catch (error) {
        if (error.message.indexOf("not found") === -1) {
            throw error;
        }
    }
    return null;
}

async function getPods(k8s, namespace) {
    const { body: { items } } = await k8s.api.v1.namespaces(namespace.metadata.name).pods.get();
    return items;
}

module.exports = { getNamespace, getConfigMap, getPods };
