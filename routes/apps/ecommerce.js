const stripe = require('stripe')(process.env.STRIPE_KEY);

function isCardValid(card) {
    if (
        card['cvc_check'] === 'fail' ||
        card['address_zip_check'] === 'fail' ||
        card['address_line1_check'] === 'fail'
    ) {
        return false;
    }

    const month = card['exp_month'];
    const year = card['exp_year'];
    const exp = new Date(year, month, 1);
    const now = new Date();
    return now < exp;
}

async function getCustomer(user) {
    const { email } = user;
    const { data: [customer=null] = {} } = await stripe.customers.list({ email, limit: 1 });
    return customer
}

async function checkIfCreditCardExists(user) {
    const customer = await getCustomer(user);
    if (customer === null) {
        return false;
    }

    const cards = await stripe.customers.listCards(customer.id);
    return cards.filter(isCardValid).length !== 0;
}

async function createSubscription(user, tier) {
    // TODO: THIS
    // create customer if it does not exist
    // let customer = await getCustomer(user);
    // if (customer === null) {
    //     customer = await stripe.customers.create({

    //     })
    // }
}

async function userHasCard(ctx) {
    const { user } = ctx.state;
    const exists = await checkIfCreditCardExists(user);
    ctx.body = { exists };
}

module.exports = { createSubscription, checkIfCreditCardExists, userHasCard };
