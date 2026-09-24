// routes/shopLayoutRoutes.js

const express = require("express");

const router = express.Router();

const controller = require("../controllers/shopLayoutController");

// ============================================================
// SHOP LAYOUT
// ============================================================

// Create a new shop layout
// POST /api/shop/layout
router.post(
  "/layout",
  controller.createLayout
);


// Get the exact layout by layout ID
// IMPORTANT: Keep this BEFORE /layout/:businessId
// GET /api/shop/layout/id/:layoutId
router.get(
  "/layout/id/:layoutId",
  controller.getLayoutById
);


// Get latest layout for a business
// GET /api/shop/layout/:businessId
router.get(
  "/layout/:businessId",
  controller.getLayout
);


// ============================================================
// SHOP OBJECTS
// ============================================================

// Add shelf / rack / counter / display / fridge
// POST /api/shop/object
router.post(
  "/object",
  controller.addObject
);


// Get one object
// GET /api/shop/object/:id
router.get(
  "/object/:id",
  controller.getObject
);


// Update object position / size / rotation / color
// PUT /api/shop/object/:id
router.put(
  "/object/:id",
  controller.updateObject
);


// Delete object
// DELETE /api/shop/object/:id
router.delete(
  "/object/:id",
  controller.deleteObject
);


// Duplicate object
// POST /api/shop/object/:id/duplicate
router.post(
  "/object/:id/duplicate",
  controller.duplicateObject
);


// Rotate object
// PUT /api/shop/object/:id/rotate
router.put(
  "/object/:id/rotate",
  controller.rotateObject
);


// ============================================================
// PRODUCT POSITION / 3D SHELF MAPPING
// ============================================================

// Assign a POS product to a 3D shelf/rack
// POST /api/shop/product-position
router.post(
  "/product-position",
  controller.assignProduct
);


// Find where a product is placed in the shop
// GET /api/shop/find-product/:productId
router.get(
  "/find-product/:productId",
  controller.findProduct
);


// Remove a product from a 3D position
// DELETE /api/shop/product-position/:id
router.delete(
  "/product-position/:id",
  controller.removeProductPosition
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;