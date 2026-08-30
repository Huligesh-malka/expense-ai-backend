const rateLimit = require("express-rate-limit");


// =====================================
// LOGIN RATE LIMIT
// =====================================

const loginRateLimit = rateLimit({

    windowMs: 15 * 60 * 1000, // 15 minutes

    max: 10, // 10 attempts per IP

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }

});


module.exports = {
    loginRateLimit
};