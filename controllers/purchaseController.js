const db = require("../config/db");

// =====================================
// CREATE PURCHASE
// =====================================

exports.createPurchase = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            business_id,
            supplier_id,
            products,
            discount,
            tax,
            payment_method,
            payment_status,
            paid_amount,
            notes
        } = req.body;

        // Validation
        if (!business_id) {
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

        // Invoice Number
        const invoiceNo =
            "PUR-" +
            Date.now().toString().slice(-8);

        let subtotal = 0;

        // Calculate subtotal
        for (const item of products) {

            subtotal +=
                Number(item.purchase_price) *
                Number(item.quantity);

        }

        const finalDiscount = Number(discount || 0);
        const finalTax = Number(tax || 0);

        const totalAmount =
            subtotal -
            finalDiscount +
            finalTax;

        const paid = Number(paid_amount || 0);

        const due = totalAmount - paid;

        // Insert Purchase
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
                    business_id,
                    supplier_id,
                    invoiceNo,
                    subtotal,
                    finalDiscount,
                    finalTax,
                    totalAmount,
                    payment_method || "Cash",
                    payment_status || "Paid",
                    paid,
                    due,
                    notes || null
                ]

            );

        const purchaseId =
            purchaseResult.insertId;

        // Save Purchase Items
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

            // Update Product Stock
            await connection.query(

                `UPDATE products
                 SET stock = stock + ?
                 WHERE id=?`,

                [
                    item.quantity,
                    item.product_id
                ]

            );

        }

        await connection.commit();

        res.status(201).json({

            success: true,

            message: "Purchase created successfully",

            purchaseId,

            invoiceNo

        });

    } catch (err) {

        await connection.rollback();

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

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

        const business_id = req.query.business_id;

        if (!business_id) {

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
            ON p.supplier_id=s.id

            WHERE p.business_id=?

            ORDER BY p.id DESC`,

            [business_id]

        );

        res.json({

            success: true,

            total: rows.length,

            data: rows

        });

    } catch (err) {

        console.log(err);

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

        const [purchase] = await db.query(

            `SELECT
                p.*,
                s.supplier_name,
                s.company_name,
                s.supplier_phone,
                s.supplier_email

            FROM purchases p

            LEFT JOIN suppliers s

            ON p.supplier_id=s.id

            WHERE p.id=?`,

            [id]

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

        console.log(err);

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

        const [purchase] = await db.query(

            `SELECT
                p.*,
                s.supplier_name,
                s.company_name,
                s.supplier_phone,
                s.address

            FROM purchases p

            LEFT JOIN suppliers s

            ON p.supplier_id=s.id

            WHERE p.id=?`,

            [id]

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

            ON pi.product_id=pr.id

            WHERE pi.purchase_id=?`,

            [id]

        );

        res.json({

            success: true,

            purchase: purchase[0],

            items

        });

    } catch (err) {

        console.log(err);

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

        const business_id = req.query.business_id;

        const [[totalPurchases]] = await db.query(

            `SELECT COUNT(*) total
             FROM purchases
             WHERE business_id=?`,

            [business_id]

        );

        const [[purchaseAmount]] = await db.query(

            `SELECT IFNULL(SUM(total_amount),0) total
             FROM purchases
             WHERE business_id=?`,

            [business_id]

        );

        const [[paidAmount]] = await db.query(

            `SELECT IFNULL(SUM(paid_amount),0) total
             FROM purchases
             WHERE business_id=?`,

            [business_id]

        );

        const [[dueAmount]] = await db.query(

            `SELECT IFNULL(SUM(due_amount),0) total
             FROM purchases
             WHERE business_id=?`,

            [business_id]

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

        console.log(err);

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

        const {
            payment_method,
            payment_status,
            paid_amount,
            notes
        } = req.body;

        const [purchase] = await connection.query(
            "SELECT * FROM purchases WHERE id=?",
            [id]
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
                payment_method=?,
                payment_status=?,
                paid_amount=?,
                due_amount=?,
                notes=?
             WHERE id=?`,

            [
                payment_method || purchase[0].payment_method,
                payment_status || purchase[0].payment_status,
                paid,
                due,
                notes || purchase[0].notes,
                id
            ]

        );

        await connection.commit();

        res.json({

            success: true,

            message: "Purchase updated successfully"

        });

    } catch (err) {

        await connection.rollback();

        console.log(err);

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

        const [purchase] = await connection.query(

            "SELECT * FROM purchases WHERE id=?",

            [id]

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

            "SELECT * FROM purchase_items WHERE purchase_id=?",

            [id]

        );

        // Reduce Stock
        for (const item of items) {

            await connection.query(

                `UPDATE products
                 SET stock = stock - ?
                 WHERE id=?`,

                [
                    item.quantity,
                    item.product_id
                ]

            );

        }

        // Delete Items
        await connection.query(

            "DELETE FROM purchase_items WHERE purchase_id=?",

            [id]

        );

        // Delete Purchase
        await connection.query(

            "DELETE FROM purchases WHERE id=?",

            [id]

        );

        await connection.commit();

        res.json({

            success: true,

            message: "Purchase deleted successfully"

        });

    } catch (err) {

        await connection.rollback();

        console.log(err);

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
    const business_id = req.query.business_id;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "Supplier ID is required"
      });
    }

    let query = `
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
      WHERE p.supplier_id = ?
    `;

    const params = [supplierId];

    if (business_id) {
      query += ` AND p.business_id = ?`;
      params.push(business_id);
    }

    query += ` ORDER BY p.id DESC`;

    const [rows] = await db.query(query, params);

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};