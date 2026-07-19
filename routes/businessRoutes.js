const express = require("express");

const router = express.Router();

const businessController = require("../controllers/businessController");

// Create Business
router.post("/create", businessController.createBusiness);

// Get All Businesses
router.get("/", businessController.getAllBusinesses);

// Get Single Business By Owner
router.get("/:owner_id", businessController.getBusiness);

// Update Business
router.put("/:id", businessController.updateBusiness);

// Delete Business
router.delete("/:id", businessController.deleteBusiness);

module.exports = router;