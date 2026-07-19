const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customerController");

router.post("/", customerController.createCustomer);

router.get("/", customerController.getCustomers);

router.get("/:id", customerController.getCustomer);

router.put("/:id", customerController.updateCustomer);


router.get("/:id/history", customerController.getCustomerHistory);

module.exports = router;