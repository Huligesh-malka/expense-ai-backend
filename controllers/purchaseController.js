const db = require("../config/db");

const PDFDocument = require("pdfkit");

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




// =====================================
// ADD PURCHASE PAYMENT
// =====================================

exports.addPurchasePayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

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
    // Get purchase
    // -----------------------------

    const [purchaseRows] = await connection.query(
      `
      SELECT
        id,
        total_amount,
        paid_amount,
        due_amount
      FROM purchases
      WHERE id = ?
      FOR UPDATE
      `,
      [id]
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
        message:
          `Payment cannot be greater than remaining balance ₹${currentDue.toFixed(2)}`
      });
    }

    // -----------------------------
    // Calculate new balance
    // -----------------------------

    const newPaidAmount =
      Number((alreadyPaid + paymentAmount).toFixed(2));

    const newDueAmount =
      Number((totalAmount - newPaidAmount).toFixed(2));

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
      WHERE id = ?
      `,
      [
        newPaidAmount,
        newDueAmount,
        paymentStatus,
        payment_method || "Cash",
        id
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
// GET PURCHASE PAYMENT HISTORY
// =====================================

exports.getPurchasePayments = async (req, res) => {
  try {
    const { id } = req.params;

    // Check purchase exists
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
      WHERE id = ?
      `,
      [id]
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

    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};



// =====================================
// DOWNLOAD SUPPLIER PAYMENT RECEIPT
// =====================================



exports.downloadPurchasePaymentReceipt = async (req, res) => {
    try {
        const { id, paymentId } = req.params;

        // Get purchase + supplier
        const [purchaseRows] = await db.query(
            `
            SELECT
                p.id,
                p.invoice_no,
                p.total_amount,
                p.business_id,
                s.supplier_name,
                s.company_name,
                s.supplier_phone,
                s.supplier_email
            FROM purchases p
            LEFT JOIN suppliers s
                ON p.supplier_id = s.id
            WHERE p.id = ?
            `,
            [id]
        );

        if (purchaseRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        const purchase = purchaseRows[0];

        // Get selected payment
        const [paymentRows] = await db.query(
            `
            SELECT
                id,
                amount,
                payment_method,
                reference_no,
                payment_date,
                notes
            FROM purchase_payments
            WHERE id = ?
              AND purchase_id = ?
            `,
            [paymentId, id]
        );

        if (paymentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        const payment = paymentRows[0];

        // Get all payments before this payment
        const [previousPayments] = await db.query(
            `
            SELECT
                id,
                amount
            FROM purchase_payments
            WHERE purchase_id = ?
              AND (
                    payment_date < ?
                    OR (
                        payment_date = ?
                        AND id < ?
                    )
                  )
            ORDER BY payment_date ASC, id ASC
            `,
            [
                id,
                payment.payment_date,
                payment.payment_date,
                payment.id
            ]
        );

        const previousPaid = previousPayments.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        const totalAmount = Number(purchase.total_amount || 0);
        const paymentAmount = Number(payment.amount || 0);

        const previousBalance = Math.max(
            0,
            totalAmount - previousPaid
        );

        const remainingBalance = Math.max(
            0,
            previousBalance - paymentAmount
        );

        const receiptNo =
            `PAY-${String(payment.id).padStart(6, "0")}`;

        // Create PDF
        const doc = new PDFDocument({
            size: "A4",
            margin: 50
        });

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${receiptNo}.pdf"`
        );

        doc.pipe(res);

        // =============================
        // HEADER
        // =============================

        doc
            .fontSize(20)
            .font("Helvetica-Bold")
            .text("SUPPLIER PAYMENT RECEIPT", {
                align: "center"
            });

        doc.moveDown();

        doc
            .fontSize(11)
            .font("Helvetica")
            .text(`Receipt No: ${receiptNo}`);

        doc.text(
            `Purchase Invoice: ${purchase.invoice_no}`
        );

        doc.moveDown();

        // =============================
        // SUPPLIER
        // =============================

        doc
            .fontSize(13)
            .font("Helvetica-Bold")
            .text("Supplier Details");

        doc.moveDown(0.5);

        doc
            .fontSize(11)
            .font("Helvetica");

        doc.text(
            `Supplier: ${purchase.supplier_name || "-"}`
        );

        doc.text(
            `Company: ${purchase.company_name || "-"}`
        );

        doc.text(
            `Phone: ${purchase.supplier_phone || "-"}`
        );

        doc.text(
            `Email: ${purchase.supplier_email || "-"}`
        );

        doc.moveDown();

        // =============================
        // PAYMENT
        // =============================

        doc
            .fontSize(13)
            .font("Helvetica-Bold")
            .text("Payment Details");

        doc.moveDown(0.5);

        doc
            .fontSize(11)
            .font("Helvetica");

        doc.text(
            `Payment Date: ${new Date(
                payment.payment_date
            ).toLocaleString("en-IN")}`
        );

        doc.text(
            `Payment Method: ${
                payment.payment_method || "Cash"
            }`
        );

        if (payment.reference_no) {
            doc.text(
                `Reference No: ${payment.reference_no}`
            );
        }

        doc.moveDown();

        // =============================
        // AMOUNTS
        // =============================

        doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("Payment Summary");

        doc.moveDown(0.5);

        doc
            .fontSize(11)
            .font("Helvetica");

        doc.text(
            `Invoice Total: ₹${totalAmount.toFixed(2)}`
        );

        doc.text(
            `Previous Balance: ₹${previousBalance.toFixed(2)}`
        );

        doc.text(
            `Payment Made: ₹${paymentAmount.toFixed(2)}`
        );

        doc
            .font("Helvetica-Bold")
            .text(
                `Remaining Balance: ₹${remainingBalance.toFixed(2)}`
            );

        doc.moveDown();

        if (payment.notes) {
            doc
                .font("Helvetica-Bold")
                .text("Notes");

            doc
                .font("Helvetica")
                .text(payment.notes);

            doc.moveDown();
        }

        // =============================
        // FOOTER
        // =============================

        doc.moveDown(2);

        doc
            .fontSize(10)
            .font("Helvetica")
            .text(
                "This receipt confirms the payment recorded against the purchase invoice.",
                {
                    align: "center"
                }
            );

        doc.moveDown();

        doc.text(
            "Generated by Billing System",
            {
                align: "center"
            }
        );

        doc.end();

    } catch (err) {

        console.log(err);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
};