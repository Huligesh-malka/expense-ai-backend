const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customerController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// =====================================
// CREATE CUSTOMER
// =====================================

router.post(
    "/",
    authMiddleware,
    businessMiddleware,
    customerController.createCustomer
);

// =====================================
// GET ALL CUSTOMERS
// =====================================

router.get(
    "/",
    authMiddleware,
    businessMiddleware,
    customerController.getCustomers
);

// =====================================
// CUSTOMER HISTORY
// IMPORTANT: before /:id
// =====================================

router.get(
    "/:id/history",
    authMiddleware,
    businessMiddleware,
    customerController.getCustomerHistory
);

// =====================================
// GET SINGLE CUSTOMER
// =====================================

router.get(
    "/:id",
    authMiddleware,
    businessMiddleware,
    customerController.getCustomer
);

// =====================================
// UPDATE CUSTOMER
// =====================================

router.put(
    "/:id",
    authMiddleware,
    businessMiddleware,
    customerController.updateCustomer
);

module.exports = router;