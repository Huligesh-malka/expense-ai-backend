// Expense AI Backend
// routes/authRoutes.js

const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");


// =====================================
// RATE LIMIT SECURITY
// =====================================

const {
    loginRateLimit
} = require("../middleware/rateLimitMiddleware");


// =====================================
// REGISTER
// =====================================

router.post(
    "/register",
    authController.register
);


// =====================================
// LOGIN
// =====================================

router.post(
    "/login",
    loginRateLimit,
    authController.login
);


// =====================================
// GOOGLE LOGIN
// =====================================

router.post(
    "/google",
    loginRateLimit,
    authController.googleLogin
);


module.exports = router;