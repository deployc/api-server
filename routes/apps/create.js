const shortuuid = require('short-uuid')('0123456789abcdefghijklmnopqrstuvwxyz');
const { ISOLATION_POLICY } = require('./isolation_policy');
const { deleteNamespace } = require('./delete');
const { createSubscription, checkIfCreditCardExists } = require('./ecommerce');
const { applyUsageLimits } = require('./tier');

const copy = o => JSON.parse(JSON.stringify(o));

const DEFAULT_TIER = 'starter';

async function createNamespace(k8s, user, appName) {
    const name = shortuuid.new();
    const tier = DEFAULT_TIER;
    const labels = { user, appName, tier, initialized: 'false' };
    const { body: namespace } = await k8s.api.v1.namespaces.post({
        body: {
            metadata: { name, labels }
        }
    });

    return [namespace, tier]
}

async function checkIfAppExists(ctx, k8s, user, appName) {
    const { body: { items: namespaces } } = await k8s.api.v1.namespaces.get({
        qs: {
            labelSelector: `user=${user},appName=${appName}`
        }
    });
    if (namespaces.length !== 0 && namespaces[0].metadata.labels.initialized === 'false') {
        const { name } = namespaces[0].metadata;
        // namespace exists, but wasn't initialized, so delete it
        await deleteNamespace(k8s, name);
    } else if (namespaces.length !== 0) {
        ctx.throw(400, `App with name ${appName} already exists.`);
    }
}

async function createNetworkPolicy(k8s, namespace) {
    const policy = Object.assign({}, copy(ISOLATION_POLICY), {
        metadata: { name: `${namespace}-policy`, namespace }
    });

    await k8s.apis['networking.k8s.io'].v1.namespaces(namespace).networkpolicies.post({
        body: policy
    });
}

async function setNamespaceInitialized(k8s, namespace) {
    await k8s.api.v1.namespaces(namespace).patch({
        body: {
            metadata: { labels: { initialized: 'true' } }
        }
    });
}

async function createApp(ctx) {
    const { k8s, user } = ctx.state;
    const { name: appName } = ctx.request.body;
    if (appName === undefined || appName === '') {
        ctx.throw(400, 'Name is required.');
    }

    // check to make sure app doesn't exist and delete if uninitialized
    await checkIfAppExists(ctx, k8s, user.username, appName);

    // check if user has a valid credit card in stripe
    // const exists = await checkIfCreditCardExists(user);
    // if (!exists) {
    //     ctx.throw(400, 'Missing payment method. Please visit https://deployc.io to enter.');
    // }

    // create the namespace
    const [namespace, tier] = await createNamespace(k8s, user.username, appName);

    try {
        // apply usage limits
        await applyUsageLimits(k8s, namespace, tier);

        // create network policy to isolate namespace
        await createNetworkPolicy(k8s, namespace.metadata.name);

        // create the subscription
        await createSubscription(user.email, tier);

        // update the namespaced to "initialized", to allow it to be used
        await setNamespaceInitialized(k8s, namespace.metadata.name);
    } catch (err) {
        // delete the namespace if we can, since we failed to create policies
        await deleteNamespace(k8s, namespace.metadata.name);

        // re-throw because we want to fail hard
        throw err;
    }

    ctx.body = { name: appName, tier };
}

module.exports = { createApp };
