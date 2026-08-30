const express = require("express");

const router = express.Router();


// =====================================
// MIDDLEWARE
// =====================================

const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/adminMiddleware");


// =====================================
// CONTROLLER
// =====================================

const {
    getDashboard,
    getAllBusinesses,
    getAllUsers
} = require("../controllers/adminController");


// =====================================
// ADMIN DASHBOARD
// =====================================

router.get(
    "/dashboard",
    authMiddleware,
    adminMiddleware,
    getDashboard
);


// =====================================
// ALL BUSINESSES
// =====================================

router.get(
    "/businesses",
    authMiddleware,
    adminMiddleware,
    getAllBusinesses
);


// =====================================
// ALL USERS
// =====================================

router.get(
    "/users",
    authMiddleware,
    adminMiddleware,
    getAllUsers
);


module.exports = router;