const Koa = require('koa');
const logger = require('koa-logger');
const body = require('koa-body');

const routes = require('./routes');
const db = require('./middleware/db');
const k8s = require('./middleware/k8s');

const app = new Koa();

app.use(logger());
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.type = 'json';
        if (ctx.status !== 500) {
            ctx.body = { error: err.message };
        } else {
            ctx.body = { error: 'Internal server error.' };
        }
        ctx.app.emit('error', err, ctx);
    }
});
app.use(body({ multipart: true }));
app.use(db());
app.use(k8s());
app.use(routes());

const server = app.listen(8000, () => {
    const { address, port } = server.address();
    console.log(`Listening on ${address}:${port}`);
});
