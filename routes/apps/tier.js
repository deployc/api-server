const { validateAppName } = require('./acl');
const { getNamespace } = require('./get');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const TIER_LIMITS_MAP = {
    starter: require('../../definitions/constraints/starter.json'),
    hobbyist: require('../../definitions/constraints/hobbyist.json'),
    premium: require('../../definitions/constraints/premium.json'),
    ultra: require('../../definitions/constraints/ultra.json')
};

async function getTier(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    validateAppName(appName);

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found.');
    }

    const { tier } = namespace.metadata.labels;

    // get pricing from stripe
    const { amount } = await stripe.plans.retrieve(tier);

    let dollars = Math.floor(amount / 100);
    let cents = amount % 100;
    if (cents < 10) {
        cents = `0${cents}`;
    }

    ctx.body = { name: tier, pricing: `$${dollars}.${cents} per hour` };
}

async function applyUsageLimits(k8s, namespace, tier) {
    if (TIER_LIMITS_MAP[tier] === undefined) {
        throw new Error(`Invalid tier: ${tier}`);
    }

    const currentTier = namespace.metadata.labels.tier;
    let op;
    try {
        await k8s.api.v1
            .namespaces(namespace.metadata.name)
            .limitranges('usage-limits')
            .get();
        op = 'patch';
    } catch (error) {
        if (error.message.indexOf('not found') === -1) {
            throw error;
        }

        op = 'post';
    }

    const limitRange = TIER_LIMITS_MAP[tier];
    if (op === 'patch') {
        await k8s.api.v1
            .namespaces(namespace.metadata.name)
            .limitranges('usage-limits')
            .patch({ body: limitRange });
    } else {
        await k8s.api.v1
            .namespaces(namespace.metadata.name)
            .limitranges
            .post({ body: limitRange });
    }
}

async function upgradeTier(ctx) {
    const { k8s, user } = ctx.state;
    const { appName } = ctx.params;
    const { tier } = ctx.request.body;
    validateAppName(appName);

    const namespace = await getNamespace(k8s, user.username, appName);
    if (namespace === null) {
        ctx.throw(404, 'App not found.');
    }

    // TODO: Change subscription

    try {
        await applyUsageLimits(k8s, namespace, tier);
    } catch (error) {
        ctx.throw(400, error.message);
    }

    ctx.body = { tier }
}

module.exports = { getTier, upgradeTier, applyUsageLimits }
