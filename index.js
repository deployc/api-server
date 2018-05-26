const Koa = require('koa')
const Router = require('koa-router')
const logger = require('koa-logger')

const app = new Koa()
const router = new Router()
router.get('/', async (ctx) => ctx.body = 'Hello');
app.use(logger())
app.use(router.routes())

const server = app.listen(8000, () => {
    const { address, port } = server.address()
    console.log(`Listening on ${address}:${port}`)
})
