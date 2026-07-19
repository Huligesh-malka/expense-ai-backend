const express = require("express");

const router = express.Router();

const controller = require("../controllers/shopLayoutController");

router.post("/layout", controller.createLayout);

router.get("/layout/:businessId", controller.getLayout);

router.post("/object", controller.addObject);

router.put("/object/:id", controller.updateObject);

router.delete("/object/:id", controller.deleteObject);

router.post("/product-position", controller.assignProduct);

router.get("/find-product/:productId", controller.findProduct);

module.exports = router;