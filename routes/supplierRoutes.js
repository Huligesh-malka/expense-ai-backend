const express = require("express");

const router = express.Router();

const supplierController = require("../controllers/supplierController");

// Create Supplier
router.post("/", supplierController.createSupplier);

// Get All Suppliers
router.get("/", supplierController.getSuppliers);

// Supplier Dashboard
router.get("/dashboard", supplierController.getSupplierDashboard);

// Get Single Supplier
router.get("/:id", supplierController.getSupplier);

// Update Supplier
router.put("/:id", supplierController.updateSupplier);

// Delete Supplier
router.put(
    "/:id/status",
    supplierController.updateSupplierStatus
);

module.exports = router;