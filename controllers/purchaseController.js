const db = require("../config/db");

// =====================================
// CREATE PURCHASE
// =====================================
exports.createPurchase = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const businessId = req.businessId;

        const {
            supplier_id,
            products,
            discount,
            tax,
            payment_method,
            paid_amount,
            notes
        } = req.body;

        // =====================================
        // VALIDATION
        // =====================================

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

        if (!supplier_id) {
            return res.status(400).json({
                success: false,
                message: "Supplier is required"
            });
        }

        if (!products || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Products are required"
            });
        }

        // Verify supplier belongs to this business
        const [supplierCheck] = await connection.query(
            "SELECT id FROM suppliers WHERE id = ? AND business_id = ?",
            [supplier_id, businessId]
        );

        if (supplierCheck.length === 0) {
            await connection.rollback();
            return res.status(403).json({
                success: false,
                message: "Supplier not found or does not belong to your business"
            });
        }

        // Verify all products belong to this business
        for (const item of products) {
            const [productCheck] = await connection.query(
                "SELECT id FROM products WHERE id = ? AND business_id = ?",
                [item.product_id, businessId]
            );

            if (productCheck.length === 0) {
                await connection.rollback();
                return res.status(403).json({
                    success: false,
                    message: `Product ${item.product_id} not found or does not belong to your business`
                });
            }
        }

        // =====================================
        // INVOICE NUMBER
        // =====================================

        const invoiceNo =
            "PUR-" +
            Date.now().toString().slice(-8);

        // =====================================
        // CALCULATE SUBTOTAL
        // =====================================

        let subtotal = 0;

        for (const item of products) {

            subtotal +=
                Number(item.purchase_price) *
                Number(item.quantity);

        }

        // =====================================
        // DISCOUNT & TAX
        // =====================================

        const finalDiscount =
            Number(discount || 0);

        const finalTax =
            Number(tax || 0);

        // =====================================
        // TOTAL
        // =====================================

        const totalAmount =
            subtotal -
            finalDiscount +
            finalTax;

        // =====================================
        // PAYMENT
        // =====================================

        const paid =
            Number(paid_amount || 0);

        const due =
            totalAmount - paid;

        // =====================================
        // INSERT PURCHASE
        // =====================================

        const [purchaseResult] =
            await connection.query(

                `INSERT INTO purchases
                (
                    business_id,
                    supplier_id,
                    invoice_no,
                    subtotal,
                    discount,
                    tax,
                    total_amount,
                    payment_method,
                    payment_status,
                    paid_amount,
                    due_amount,
                    notes
                )
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

                [
                    businessId,
                    supplier_id,
                    invoiceNo,
                    subtotal,
                    finalDiscount,
                    finalTax,
                    totalAmount,
                    payment_method || "Cash",

                    // Automatically determine status
                    paid >= totalAmount
                        ? "Paid"
                        : paid > 0
                            ? "Partial"
                            : "Unpaid",

                    paid,
                    due,
                    notes || null
                ]
            );

        const purchaseId =
            purchaseResult.insertId;

        // =====================================
        // CREATE INITIAL PAYMENT TRANSACTION
        // =====================================

        if (paid > 0) {

            await connection.query(

                `INSERT INTO purchase_payments
                (
                    purchase_id,
                    amount,
                    payment_method,
                    reference_no,
                    payment_date,
                    notes
                )
                VALUES
                (?, ?, ?, ?, ?, ?)`,

                [
                    purchaseId,
                    paid,
                    payment_method || "Cash",
                    null,
                    new Date(),
                    "Initial payment at purchase creation"
                ]

            );

        }

        // =====================================
        // SAVE PURCHASE ITEMS
        // =====================================

        for (const item of products) {

            const total =
                Number(item.purchase_price) *
                Number(item.quantity);

            await connection.query(

                `INSERT INTO purchase_items
                (
                    purchase_id,
                    product_id,
                    quantity,
                    purchase_price,
                    tax,
                    total
                )
                VALUES
                (?, ?, ?, ?, ?, ?)`,

                [
                    purchaseId,
                    item.product_id,
                    item.quantity,
                    item.purchase_price,
                    item.tax || 0,
                    total
                ]

            );

            // =====================================
            // UPDATE PRODUCT STOCK
            // =====================================

            await connection.query(

                `UPDATE products
                 SET stock = stock + ?
                 WHERE id = ? AND business_id = ?`,

                [
                    item.quantity,
                    item.product_id,
                    businessId
                ]

            );

        }

        // =====================================
        // COMMIT
        // =====================================

        await connection.commit();

        // =====================================
        // RESPONSE
        // =====================================

        res.status(201).json({

            success: true,

            message: "Purchase created successfully",

            purchaseId,

            invoiceNo

        });

    } catch (err) {

        await connection.rollback();

        console.error(
            "Create Purchase Error:",
            err
        );

        res.status(500).json({

            success: false,

            message: "Failed to create purchase",

            error: err.message

        });

    } finally {

        connection.release();

    }

};

// =====================================
// GET ALL PURCHASES
// =====================================
exports.getPurchases = async (req, res) => {

    try {

        const businessId = req.businessId;

        if (!businessId) {

            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });

        }

        const [rows] = await db.query(

            `SELECT
                p.id,
                p.invoice_no,
                s.supplier_name,
                p.subtotal,
                p.discount,
                p.tax,
                p.total_amount,
                p.payment_method,
                p.payment_status,
                p.paid_amount,
                p.due_amount,
                p.created_at

            FROM purchases p

            LEFT JOIN suppliers s
            ON p.supplier_id = s.id

            WHERE p.business_id = ?

            ORDER BY p.id DESC`,

            [businessId]

        );

        res.json({

            success: true,

            total: rows.length,

            data: rows

        });

    } catch (err) {

        console.error("Get Purchases Error:", err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// =====================================
// GET SINGLE PURCHASE
// =====================================
exports.getPurchase = async (req, res) => {

    try {

        const { id } = req.params;
        const businessId = req.businessId;

        const [purchase] = await db.query(

            `SELECT
                p.*,
                s.supplier_name,
                s.company_name,
                s.supplier_phone,
                s.supplier_email

            FROM purchases p

            LEFT JOIN suppliers s
            ON p.supplier_id = s.id

            WHERE p.id = ? AND p.business_id = ?`,

            [id, businessId]

        );

        if (purchase.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Purchase not found"

            });

        }

        res.json({

            success: true,

            data: purchase[0]

        });

    } catch (err) {

        console.error("Get Purchase Error:", err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// =====================================
// GET PURCHASE DETAILS
// =====================================
exports.getPurchaseDetails = async (req, res) => {

    try {

        const { id } = req.params;
        const businessId = req.businessId;

        const [purchase] = await db.query(

            `SELECT
                p.*,
                s.supplier_name,
                s.company_name,
                s.supplier_phone,
                s.address

            FROM purchases p

            LEFT JOIN suppliers s
            ON p.supplier_id = s.id

            WHERE p.id = ? AND p.business_id = ?`,

            [id, businessId]

        );

        if (purchase.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Purchase not found"

            });

        }

        const [items] = await db.query(

            `SELECT

                pi.id,

                pi.product_id,

                pr.product_name,

                pr.product_code,

                pi.quantity,

                pi.purchase_price,

                pi.tax,

                pi.total

            FROM purchase_items pi

            LEFT JOIN products pr
            ON pi.product_id = pr.id

            WHERE pi.purchase_id = ?`,

            [id]

        );

        res.json({

            success: true,

            purchase: purchase[0],

            items

        });

    } catch (err) {

        console.error("Get Purchase Details Error:", err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// =====================================
// PURCHASE DASHBOARD
// =====================================
exports.purchaseDashboard = async (req, res) => {

    try {

        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

        const [[totalPurchases]] = await db.query(

            `SELECT COUNT(*) as total
             FROM purchases
             WHERE business_id = ?`,

            [businessId]

        );

        const [[purchaseAmount]] = await db.query(

            `SELECT IFNULL(SUM(total_amount), 0) as total
             FROM purchases
             WHERE business_id = ?`,

            [businessId]

        );

        const [[paidAmount]] = await db.query(

            `SELECT IFNULL(SUM(paid_amount), 0) as total
             FROM purchases
             WHERE business_id = ?`,

            [businessId]

        );

        const [[dueAmount]] = await db.query(

            `SELECT IFNULL(SUM(due_amount), 0) as total
             FROM purchases
             WHERE business_id = ?`,

            [businessId]

        );

        res.json({

            success: true,

            data: {

                total_purchases: totalPurchases.total,

                total_purchase_amount: purchaseAmount.total,

                total_paid: paidAmount.total,

                total_due: dueAmount.total

            }

        });

    } catch (err) {

        console.error("Purchase Dashboard Error:", err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// =====================================
// UPDATE PURCHASE
// =====================================
exports.updatePurchase = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;
        const businessId = req.businessId;

        const {
            payment_method,
            payment_status,
            paid_amount,
            notes
        } = req.body;

        const [purchase] = await connection.query(
            "SELECT * FROM purchases WHERE id = ? AND business_id = ?",
            [id, businessId]
        );

        if (purchase.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });

        }

        const total = Number(purchase[0].total_amount);

        const paid = Number(paid_amount || 0);

        const due = total - paid;

        await connection.query(

            `UPDATE purchases
             SET
                payment_method = ?,
                payment_status = ?,
                paid_amount = ?,
                due_amount = ?,
                notes = ?
             WHERE id = ? AND business_id = ?`,

            [
                payment_method || purchase[0].payment_method,
                payment_status || purchase[0].payment_status,
                paid,
                due,
                notes || purchase[0].notes,
                id,
                businessId
            ]

        );

        await connection.commit();

        res.json({

            success: true,

            message: "Purchase updated successfully"

        });

    } catch (err) {

        await connection.rollback();

        console.error("Update Purchase Error:", err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    } finally {

        connection.release();

    }

};

// =====================================
// DELETE PURCHASE
// =====================================
exports.deletePurchase = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const { id } = req.params;
        const businessId = req.businessId;

        const [purchase] = await connection.query(

            "SELECT * FROM purchases WHERE id = ? AND business_id = ?",

            [id, businessId]

        );

        if (purchase.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message: "Purchase not found"

            });

        }

        // Get Purchase Items
        const [items] = await connection.query(

            "SELECT * FROM purchase_items WHERE purchase_id = ?",

            [id]

        );

        // Reduce Stock
        for (const item of items) {

            await connection.query(

                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ? AND business_id = ?`,

                [
                    item.quantity,
                    item.product_id,
                    businessId
                ]

            );

        }

        // Delete Items
        await connection.query(

            "DELETE FROM purchase_items WHERE purchase_id = ?",

            [id]

        );

        // Delete Purchase
        await connection.query(

            "DELETE FROM purchases WHERE id = ? AND business_id = ?",

            [id, businessId]

        );

        await connection.commit();

        res.json({

            success: true,

            message: "Purchase deleted successfully"

        });

    } catch (err) {

        await connection.rollback();

        console.error("Delete Purchase Error:", err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    } finally {

        connection.release();

    }

};

// =====================================
// GET SUPPLIER PURCHASES
// =====================================
exports.getSupplierPurchases = async (req, res) => {
    try {
        const { supplierId } = req.params;
        const businessId = req.businessId;

        if (!supplierId) {
            return res.status(400).json({
                success: false,
                message: "Supplier ID is required"
            });
        }

        // First verify the supplier belongs to this business
        const [supplierCheck] = await db.query(
            "SELECT id FROM suppliers WHERE id = ? AND business_id = ?",
            [supplierId, businessId]
        );

        if (supplierCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Supplier not found or does not belong to your business"
            });
        }

        // Get all purchases for this supplier
        const [rows] = await db.query(
            `
            SELECT
                p.id,
                p.invoice_no,
                p.subtotal,
                p.discount,
                p.tax,
                p.total_amount,
                p.payment_method,
                p.payment_status,
                p.paid_amount,
                p.due_amount,
                p.notes,
                p.created_at
            FROM purchases p
            WHERE p.supplier_id = ? AND p.business_id = ?
            ORDER BY p.id DESC
            `,
            [supplierId, businessId]
        );

        res.json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("Get Supplier Purchases Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// ADD PURCHASE PAYMENT
// =====================================
exports.addPurchasePayment = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const businessId = req.businessId;

        const {
            amount,
            payment_method,
            reference_no,
            payment_date,
            notes
        } = req.body;

        // -----------------------------
        // Validate amount
        // -----------------------------

        const paymentAmount = Number(amount);

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Valid payment amount is required"
            });
        }

        // -----------------------------
        // Get purchase with business check
        // -----------------------------

        const [purchaseRows] = await connection.query(
            `
            SELECT
                id,
                total_amount,
                paid_amount,
                due_amount
            FROM purchases
            WHERE id = ? AND business_id = ?
            FOR UPDATE
            `,
            [id, businessId]
        );

        if (purchaseRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        const purchase = purchaseRows[0];

        const totalAmount = Number(purchase.total_amount || 0);
        const alreadyPaid = Number(purchase.paid_amount || 0);
        const currentDue = Number(purchase.due_amount || 0);

        // -----------------------------
        // Already fully paid
        // -----------------------------

        if (currentDue <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "This purchase is already fully paid"
            });
        }

        // -----------------------------
        // Prevent overpayment
        // -----------------------------

        if (paymentAmount > currentDue) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: `Payment cannot be greater than remaining balance ₹${currentDue.toFixed(2)}`
            });
        }

        // -----------------------------
        // Calculate new balance
        // -----------------------------

        const newPaidAmount = Number((alreadyPaid + paymentAmount).toFixed(2));
        const newDueAmount = Number((totalAmount - newPaidAmount).toFixed(2));

        let paymentStatus = "Partial";

        if (newDueAmount <= 0) {
            paymentStatus = "Paid";
        }

        // -----------------------------
        // Create payment transaction
        // -----------------------------

        const [paymentResult] = await connection.query(
            `
            INSERT INTO purchase_payments
            (
                purchase_id,
                amount,
                payment_method,
                reference_no,
                payment_date,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                id,
                paymentAmount,
                payment_method || "Cash",
                reference_no || null,
                payment_date || new Date(),
                notes || null
            ]
        );

        // -----------------------------
        // Update purchase summary
        // -----------------------------

        await connection.query(
            `
            UPDATE purchases
            SET
                paid_amount = ?,
                due_amount = ?,
                payment_status = ?,
                payment_method = ?
            WHERE id = ? AND business_id = ?
            `,
            [
                newPaidAmount,
                newDueAmount,
                paymentStatus,
                payment_method || "Cash",
                id,
                businessId
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: "Payment added successfully",

            data: {
                payment_id: paymentResult.insertId,
                purchase_id: Number(id),

                payment_amount: paymentAmount,

                total_amount: totalAmount,
                paid_amount: newPaidAmount,
                due_amount: newDueAmount,

                payment_status: paymentStatus
            }
        });

    } catch (err) {

        await connection.rollback();

        console.error("Add Purchase Payment Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    } finally {
        connection.release();
    }
};

// =====================================
// GET PURCHASE PAYMENT HISTORY
// =====================================
exports.getPurchasePayments = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        // Check purchase exists and belongs to business
        const [purchaseRows] = await db.query(
            `
            SELECT
                id,
                invoice_no,
                total_amount,
                paid_amount,
                due_amount,
                payment_status
            FROM purchases
            WHERE id = ? AND business_id = ?
            `,
            [id, businessId]
        );

        if (purchaseRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        const [payments] = await db.query(
            `
            SELECT
                id,
                purchase_id,
                amount,
                payment_method,
                reference_no,
                payment_date,
                notes,
                created_at
            FROM purchase_payments
            WHERE purchase_id = ?
            ORDER BY payment_date ASC, id ASC
            `,
            [id]
        );

        res.json({
            success: true,

            purchase: purchaseRows[0],

            total_payments: payments.length,

            data: payments
        });

    } catch (err) {

        console.error("Get Purchase Payments Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};