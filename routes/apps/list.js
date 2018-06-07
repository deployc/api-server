async function listApps(ctx) {
    const { k8s } = ctx.state;
    const { username } = ctx.state.user;
    const { body } = await k8s.api.v1.namespaces.get({
        qs: {
            labelSelector: `user=${username},initialized=true`
        }
    });
    const apps = body.items.map(ns => {
        return {
            name: ns.metadata.labels.appName,
            tier: ns.metadata.labels.tier,
            services: [],
            createdAt: ns.metadata.creationTimestamp
        }
    });
    ctx.body = { apps };
}

module.exports = { listApps };
