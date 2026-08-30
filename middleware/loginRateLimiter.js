const rateLimit = require("express-rate-limit");


// =====================================
// LOGIN RATE LIMIT
// =====================================

const loginRateLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 10,

    standardHeaders: true,

    legacyHeaders: false,

    skipSuccessfulRequests: true,

    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }

});


module.exports = loginRateLimiter;