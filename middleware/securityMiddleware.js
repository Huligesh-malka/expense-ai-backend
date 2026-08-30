const helmet = require("helmet");


// =====================================
// SECURITY HEADERS
// =====================================

const securityMiddleware = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
});


module.exports = securityMiddleware;