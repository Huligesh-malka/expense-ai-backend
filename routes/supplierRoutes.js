const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/supplierController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// All routes protected with both middlewares
router.post("/", authMiddleware, businessMiddleware, supplierController.createSupplier);
router.get("/", authMiddleware, businessMiddleware, supplierController.getSuppliers);
router.get("/dashboard", authMiddleware, businessMiddleware, supplierController.getSupplierDashboard);
router.get("/:id", authMiddleware, businessMiddleware, supplierController.getSupplier);
router.put("/:id", authMiddleware, businessMiddleware, supplierController.updateSupplier);
router.put("/:id/status", authMiddleware, businessMiddleware, supplierController.updateSupplierStatus);

module.exports = router;