const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

router.get(
    "/",
    auth,
    businessMiddleware,
    dashboardController.getDashboard
);

module.exports = router;