    const express = require("express");
    const router = express.Router();

    const productController = require("../controllers/productController");

    const authMiddleware = require("../middleware/auth");
    const businessMiddleware = require("../middleware/businessMiddleware");

    // =====================================
    // CREATE
    // =====================================

    router.post(
        "/create",
        authMiddleware,
        businessMiddleware,
        productController.createProduct
    );

    // =====================================
    // READ ALL
    // =====================================

    router.get(
        "/",
        authMiddleware,
        businessMiddleware,
        productController.getProducts
    );

    // =====================================
    // BARCODE
    // =====================================

    router.get(
        "/barcode/:barcode",
        authMiddleware,
        businessMiddleware,
        productController.getProductByBarcode
    );

    // =====================================
    // SINGLE PRODUCT
    // =====================================

    router.get(
        "/:id",
        authMiddleware,
        businessMiddleware,
        productController.getProduct
    );

    // =====================================
    // UPDATE
    // =====================================

    router.put(
        "/:id",
        authMiddleware,
        businessMiddleware,
        productController.updateProduct
    );

    // =====================================
    // DELETE
    // =====================================

    router.delete(
        "/:id",
        authMiddleware,
        businessMiddleware,
        productController.deleteProduct
    );

    module.exports = router;