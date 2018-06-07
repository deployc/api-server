const stripe = require('stripe')(process.env.STRIPE_KEY);

const CONTAINER_PRODUCT_ID = process.env.CONTAINER_PRODUCT_ID;

async function getTiers(ctx) {
    const { data } = await stripe.plans.list({
        product: CONTAINER_PRODUCT_ID
    });

    data.sort((a, b) => a.amount - b.amount);

    const tiers = data.map(({ nickname, amount }) => {
        const dollars = Math.floor(amount / 100);
        let cents = amount % 100;
        if (cents < 10) {
            cents = `0${cents}`;
        }
        const pricing = `$${dollars}.${cents} per hour`;
        return { name: nickname, pricing };
    });

    ctx.body = {
        tiers
    }
}

module.exports = {
    register(pub, priv) {
        pub.get('/tiers', getTiers);
    }
}
