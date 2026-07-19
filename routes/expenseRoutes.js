const express = require("express");

const router = express.Router();

const expenseController = require("../controllers/expenseController");

// Create
router.post("/add", expenseController.addExpense);

// Read
router.get("/", expenseController.getExpenses);

router.get("/:id", expenseController.getExpenseById);

// Update
router.put("/:id", expenseController.updateExpense);

// Delete
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;