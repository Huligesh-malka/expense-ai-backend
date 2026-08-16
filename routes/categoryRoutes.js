const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// =========================
// Create Category
// =========================
router.post(
    "/create",
    authMiddleware,
    businessMiddleware,
    categoryController.createCategory
);

// =========================
// Get All Categories
// =========================
router.get(
    "/business/:businessId",
    authMiddleware,
    businessMiddleware,
    categoryController.getCategories
);

// =========================
// Get Category By ID
// =========================
router.get(
    "/:id",
    authMiddleware,
    businessMiddleware,
    categoryController.getCategoryById
);

// =========================
// Update Category
// =========================
router.put(
    "/:id",
    authMiddleware,
    businessMiddleware,
    categoryController.updateCategory
);

// =========================
// Delete Category
// =========================
router.delete(
    "/:id",
    authMiddleware,
    businessMiddleware,
    categoryController.deleteCategory
);

module.exports = router;