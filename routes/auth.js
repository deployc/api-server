const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Router = require('koa-router');

const { JWT_SECRET='testing-1234abcd' } = process.env;
const DEFAULT_JWT_EXPIRES_SEC = 604800; // 7 days in `s`
const DEFAULT_NBF_BUFFER_MS = 3600000; // 1 hour in `ms`

function makeToken(user) {
    const { id, username } = user;
    const issuedAt = new Date();
    const notBefore = new Date(issuedAt.valueOf() - DEFAULT_NBF_BUFFER_MS)
    const expiresAt = new Date(issuedAt.valueOf() + DEFAULT_JWT_EXPIRES_SEC*1000);
    const payload = {
        id, username,
        nbf: Math.floor(notBefore/1000),
        iat: Math.floor(issuedAt/1000),
        exp: Math.floor(expiresAt/1000)
    }
    const token = jwt.sign(payload, JWT_SECRET);
    return { token, expiresAt, issuedAt };
}

async function login(ctx) {
    const { db } = ctx.state;
    const { username, password } = ctx.request.body;
    const user = await db('users').where({ username: username.toLowerCase() }).first();
    if (!user) {
        // TODO: Random sleep here to prevent timing attacks?
        ctx.throw(401, 'Invalid username/password');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        ctx.throw(401, 'Invalid username/password');
    }

    ctx.body = makeToken(user);
}

async function signup(ctx) {
    const { db } = ctx.state;
    const { username, email, password } = ctx.request.body;
    const existingUser = await db('users').where({ username: username.toLowerCase() }).first();
    if (existingUser) {
        ctx.throw(400, `Username ${username} already exists.`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = { username, email, password: hashedPassword };
    const [id] = await db('users').insert(user, 'id');
    user.id = id;

    // Don't send the hashed password back in the response
    delete user.hashedPassword;
    const { token, expiresAt, issuedAt } = makeToken(user); 
    user.token = token;
    user.tokenExpiresAt = expiresAt;
    user.tokenIssuedAt = issuedAt;
    ctx.body = user;
}

async function refresh(ctx) {
    ctx.body = makeToken(ctx.state.user);
}

module.exports = {
    register(pub, priv) {
        pub.post('/login', login);
        pub.post('/signup', signup);
        priv.get('/refresh', refresh);
    }
};
