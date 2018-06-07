const Router = require('koa-router');
const jwt = require('koa-jwt');
const apps = require('./apps');
const auth = require('./auth');
const tiers = require('./tiers');

const { JWT_SECRET } = process.env;

module.exports = function() {
    const router = new Router();

    const priv = new Router();
    priv.use(jwt({ secret: JWT_SECRET }));

    const pub = new Router();

    tiers.register(pub, priv);
    apps.register(pub, priv);
    auth.register(pub, priv);

    router.use(pub.routes());
    router.use(priv.routes());
    return router.routes();
}
