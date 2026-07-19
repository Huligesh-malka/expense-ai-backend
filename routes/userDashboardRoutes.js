const express = require("express");
const router = express.Router();

const userDashboardController = require("../controllers/userDashboardController");
const auth = require("../middleware/auth");

// User Dashboard
router.get("/dashboard", auth, userDashboardController.getDashboard);

module.exports = router;