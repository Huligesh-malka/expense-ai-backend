const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/supplierController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// =====================================
// CREATE SUPPLIER
// =====================================

router.post(
    "/",
    authMiddleware,
    businessMiddleware,
    supplierController.createSupplier
);

// =====================================
// GET ALL SUPPLIERS
// =====================================

router.get(
    "/",
    authMiddleware,
    businessMiddleware,
    supplierController.getSuppliers
);

// =====================================
// SUPPLIER DASHBOARD
// IMPORTANT: MUST be before /:id
// =====================================

router.get(
    "/dashboard",
    authMiddleware,
    businessMiddleware,
    supplierController.getSupplierDashboard
);

// =====================================
// UPDATE SUPPLIER STATUS (ACTIVATE/INACTIVATE)
// IMPORTANT: MUST be before /:id
// =====================================

router.put(
    "/:id/status",
    authMiddleware,
    businessMiddleware,
    supplierController.updateSupplierStatus
);

// =====================================
// GET SINGLE SUPPLIER
// =====================================

router.get(
    "/:id",
    authMiddleware,
    businessMiddleware,
    supplierController.getSupplier
);

// =====================================
// UPDATE SUPPLIER
// =====================================

router.put(
    "/:id",
    authMiddleware,
    businessMiddleware,
    supplierController.updateSupplier
);

module.exports = router;