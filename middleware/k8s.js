const { Client, config } = require('kubernetes-client');
const certificateCRD = require('../definitions/certificate-crd.json');

function _loadSpec(client) {
    let specLoaded = false;
    return async () => {
        if (!specLoaded) {
            await client.loadSpec();
            client.addCustomResourceDefinition(certificateCRD);
            specLoaded = true;
        }
    };
}

module.exports = function() {
    const client = new Client({ config: config.getInCluster() });
    const loadSpec = _loadSpec(client);
    return async function(ctx, next) {
        await loadSpec(client);
        ctx.state.k8s = client;
        await next();
    };
};
