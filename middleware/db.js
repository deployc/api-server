const knex = require('knex')
const Router = require('koa-router')

const { PG_HOST, PG_DB, PG_USER='postgres', PG_PASSWORD } = process.env
const db = knex({
    client: 'pg',
    connection: {
        host: PG_HOST,
        database: PG_DB,
        user: PG_USER,
        password: PG_PASSWORD
    },
    pool: {
        min: 0,
        max: 15
    }
})

module.exports = function() {
    return function(ctx, next) {
        return db.transaction(tx => {
            ctx.state.db = tx
            return next()
        })
    }
}
