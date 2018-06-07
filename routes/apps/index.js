const { listApps } = require('./list');
const { createApp } = require('./create');
const { deployApp } = require('./deploy');
const { deleteApp } = require('./delete');
const { getSecrets, createSecret } = require('./secrets');
const { getEnv, setEnv } = require('./env');
const { logs } = require('./logs');
const { getTier } = require('./tier');
const { userHasCard } = require('./ecommerce');

module.exports = {
    register(pub, priv) {
        priv.get('/apps', listApps);
        priv.post('/apps', createApp);
        priv.post('/apps/:appName/up', deployApp);
        priv.get('/apps/:appName/secrets', getSecrets);
        priv.post('/apps/:appName/secrets', createSecret);
        priv.get('/apps/:appName/env', getEnv);
        priv.post('/apps/:appName/env', setEnv);
        priv.get('/apps/:appName/logs', logs);
        priv.del('/apps/:appName', deleteApp);
        priv.get('/apps/:appName/tier', getTier);
        priv.get('/has-card', userHasCard);
    }
}
