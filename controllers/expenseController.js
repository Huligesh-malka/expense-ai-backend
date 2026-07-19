// Expense AI Backend
const db = require("../config/db");



exports.addExpense = async (req, res) => {

    try {

        const {
            user_id,
            merchant,
            expense_name,
            category_id,
            amount,
            expense_date,
            payment_method,
            notes,
            products
        } = req.body;

        // Validation
        if (
            !user_id ||
            !expense_name ||
            !category_id ||
            !amount ||
            !expense_date
        ) {

            return res.status(400).json({
                success: false,
                message: "Please fill all required fields."
            });

        }

        // Save Expense
        const [expenseResult] = await db.query(

            `INSERT INTO expenses
            (
                user_id,
                category_id,
                merchant,
                expense_name,
                amount,
                expense_date,
                payment_method,
                notes
            )
            VALUES (?,?,?,?,?,?,?,?)`,

            [
                user_id,
                category_id,
                merchant || null,
                expense_name,
                Number(amount),
                expense_date,
                payment_method || null,
                notes || null
            ]

        );

        const expenseId = expenseResult.insertId;

        // ==========================
        // Save Products
        // ==========================

        if (Array.isArray(products)) {

            for (const item of products) {

                if (!item.product_name?.trim()) {
                    continue;
                }

                const quantity = Number(item.quantity) || 1;

                const unitPrice = Number(item.unit_price) || 0;

                const subtotal = quantity * unitPrice;

                const discount = Number(item.discount) || 0;

                const afterDiscount = subtotal - discount;

                const gstApplicable = item.gst_applicable ? 1 : 0;

                const gstPercent = Number(item.gst_percent) || 0;

                let gstAmount = 0;

                if (gstApplicable) {

                    gstAmount =
                        (afterDiscount * gstPercent) / 100;

                }

                const finalPrice =
                    afterDiscount + gstAmount;

                await db.query(

                    `INSERT INTO receipt_items
                    (
                        expense_id,
                        product_name,
                        quantity,
                        unit_price,
                        discount,
                        gst_applicable,
                        gst_percent,
                        gst,
                        total_price,
                        final_price
                    )
                    VALUES
                    (
                        ?,?,?,?,?,?,?,?,?,?
                    )`,

                    [
                        expenseId,
                        item.product_name.trim(),
                        quantity,
                        unitPrice,
                        discount,
                        gstApplicable,
                        gstPercent,
                        gstAmount,
                        subtotal,
                        finalPrice
                    ]

                );

            }

        }

        res.status(201).json({

            success: true,

            message: "Expense Added Successfully",

            expense_id: expenseId

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};


exports.getExpenses = async (req, res) => {

    try {

        const userId = req.query.user_id;

        const [expenses] = await db.query(

            `SELECT
                e.id,
                e.merchant,
                e.expense_name,
                c.category_name,
                e.amount,
                e.expense_date,
                e.payment_method,
                e.notes,
                e.created_at
            FROM expenses e
            LEFT JOIN categories c
            ON e.category_id = c.id
            WHERE e.user_id=?
            ORDER BY e.id DESC`,

            [userId]

        );

        res.json({

            success: true,

            total: expenses.length,

            data: expenses

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};




exports.getExpenseById = async (req, res) => {

    try {

        const { id } = req.params;

        // Expense Details
        const [expense] = await db.query(
            `SELECT
                e.*,
                c.category_name
            FROM expenses e
            LEFT JOIN categories c
            ON e.category_id = c.id
            WHERE e.id=?`,
            [id]
        );

        if (expense.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });

        }

        // Product Details
        const [products] = await db.query(
            `SELECT
                product_name,
                quantity,
                unit_price,
                discount,
                gst_applicable,
                gst_percent,
                gst,
                total_price,
                final_price
            FROM receipt_items
            WHERE expense_id=?`,
            [id]
        );

        // Bill Summary
        let subtotal = 0;
        let discount = 0;
        let gst = 0;
        let grandTotal = 0;

        products.forEach(item => {

            subtotal += Number(item.total_price);

            discount += Number(item.discount);

            gst += Number(item.gst);

            grandTotal += Number(item.final_price);

        });

        res.json({

            success: true,

            expense: expense[0],

            products,

            summary: {

                subtotal,

                discount,

                gst,

                grandTotal

            }

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};




exports.updateExpense = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            merchant,
            expense_name,
            category_id,
            amount,
            expense_date,
            payment_method,
            notes,
            products
        } = req.body;

        // ==========================
        // Update Expense
        // ==========================

        await db.query(

            `UPDATE expenses
            SET
                merchant=?,
                expense_name=?,
                category_id=?,
                amount=?,
                expense_date=?,
                payment_method=?,
                notes=?
            WHERE id=?`,

            [
                merchant,
                expense_name,
                category_id,
                amount,
                expense_date,
                payment_method,
                notes,
                id
            ]

        );

        // ==========================
        // Remove Old Products
        // ==========================

        await db.query(

            "DELETE FROM receipt_items WHERE expense_id=?",

            [id]

        );

        // ==========================
        // Insert Updated Products
        // ==========================

        if (Array.isArray(products)) {

            for (const item of products) {

                if (!item.product_name?.trim()) {
                    continue;
                }

                const quantity = Number(item.quantity) || 1;

                const unitPrice = Number(item.unit_price) || 0;

                const subtotal = quantity * unitPrice;

                const discount = Number(item.discount) || 0;

                const afterDiscount = subtotal - discount;

                const gstApplicable = item.gst_applicable ? 1 : 0;

                const gstPercent = Number(item.gst_percent) || 0;

                let gstAmount = 0;

                if (gstApplicable) {

                    gstAmount = (afterDiscount * gstPercent) / 100;

                }

                const finalPrice = afterDiscount + gstAmount;

                await db.query(

                    `INSERT INTO receipt_items
                    (
                        expense_id,
                        product_name,
                        quantity,
                        unit_price,
                        discount,
                        gst_applicable,
                        gst_percent,
                        gst,
                        total_price,
                        final_price
                    )
                    VALUES
                    (
                        ?,?,?,?,?,?,?,?,?,?
                    )`,

                    [
                        id,
                        item.product_name.trim(),
                        quantity,
                        unitPrice,
                        discount,
                        gstApplicable,
                        gstPercent,
                        gstAmount,
                        subtotal,
                        finalPrice
                    ]

                );

            }

        }

        res.json({

            success: true,

            message: "Expense Updated Successfully"

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};



exports.deleteExpense = async (req, res) => {

    try {

        const { id } = req.params;

        await db.query(
            "DELETE FROM expenses WHERE id=?",
            [id]
        );

        res.json({
            success: true,
            message: "Expense Deleted Successfully"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};