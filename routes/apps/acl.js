function validateAppName(appName) {
    if (appName === '') {
        ctx.throw(400, 'App name must be non-empty.');
    }
}

module.exports = {
    validateAppName
};
