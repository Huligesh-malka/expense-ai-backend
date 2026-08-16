const db = require("../config/db");

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Convert quantity from one unit to another
 */
const convertUnit = (quantity, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return quantity;
    let quantityInBase = quantity;
    if (fromUnit === 'kg') {
        quantityInBase = quantity * 1000;
    } else if (fromUnit === 'l') {
        quantityInBase = quantity * 1000;
    } else if (fromUnit === 'dozen') {
        quantityInBase = quantity * 12;
    }
    let result = quantityInBase;
    if (toUnit === 'kg') {
        result = quantityInBase / 1000;
    } else if (toUnit === 'l') {
        result = quantityInBase / 1000;
    } else if (toUnit === 'dozen') {
        result = quantityInBase / 12;
    }
    return result;
};

/**
 * Calculate price based on product and quantity
 */
const calculatePrice = (product, quantity, enteredUnit) => {
    const productUnit = product.price_unit || 'pcs';
    const pricePerUnit = product.selling_price / product.price_per;
    const convertedQuantity = convertUnit(quantity, enteredUnit, productUnit);
    const totalPrice = Number((convertedQuantity * pricePerUnit).toFixed(2));
    const unitPrice = Number(pricePerUnit.toFixed(2));
    return { totalPrice, unitPrice, convertedQuantity };
};

// =====================================
// CREATE SALE - SECURED
// =====================================

exports.createSale = async (req, res) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const {
            customer_id,
            customer_name,
            customer_phone,
            payment_method,
            payment_status,
            discount = 0,
            gst = 18,
            items
        } = req.body;

        // =====================================
        // IMPORTANT: Get businessId from middleware
        // DO NOT trust business_id from frontend
        // =====================================
        const businessId = req.businessId;

        if (!businessId) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        // Validation: Items
        if (!items || items.length === 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Please add products."
            });
        }

        const validUnits = [
            "pcs", "g", "kg", "ml", "l",
            "pack", "box", "bottle",
            "dozen", "meter", "feet"
        ];

        let subtotal = 0;

        // FIRST LOOP: Validate items and calculate subtotal
        for (const item of items) {
            if (Number(item.quantity) <= 0) {
                throw new Error("Quantity must be greater than 0");
            }

            const enteredUnit = item.entered_unit || "pcs";
            if (!validUnits.includes(enteredUnit)) {
                throw new Error(`Invalid unit: ${enteredUnit}`);
            }

            // SECURITY: Check product belongs to this business
            const [product] = await conn.query(
                "SELECT * FROM products WHERE id = ? AND business_id = ?",
                [item.product_id, businessId]
            );

            if (product.length === 0) {
                throw new Error(`Product with ID ${item.product_id} not found in this business`);
            }

            if (product[0].status !== "active") {
                throw new Error(
                    `${product[0].product_name} is inactive and cannot be sold`
                );
            }

            const { totalPrice } = calculatePrice(
                product[0],
                Number(item.quantity),
                enteredUnit
            );

            subtotal += totalPrice;
        }

        subtotal = Number(subtotal.toFixed(2));

        const discountAmount = Number((subtotal * (Number(discount) / 100)).toFixed(2));
        const taxableAmount = Number((subtotal - discountAmount).toFixed(2));
        const tax = Number((taxableAmount * (Number(gst) / 100)).toFixed(2));
        const total_amount = Number((taxableAmount + tax).toFixed(2));
        const cgst = Number((tax / 2).toFixed(2));
        const sgst = Number((tax / 2).toFixed(2));

        // =====================================
        // FIND OR CREATE CUSTOMER - SECURED
        // =====================================

        let finalCustomerId = customer_id || null;

        if (customer_phone && customer_phone.trim() !== "") {
            // SECURITY: Check customer belongs to this business
            const [existingCustomer] = await conn.query(
                `SELECT id
                 FROM customers
                 WHERE business_id = ?
                 AND customer_phone = ?`,
                [businessId, customer_phone]
            );

            if (existingCustomer.length > 0) {
                finalCustomerId = existingCustomer[0].id;
            } else {
                const [newCustomer] = await conn.query(
                    `INSERT INTO customers
                    (business_id, customer_name, customer_phone)
                    VALUES (?, ?, ?)`,
                    [businessId, customer_name || "Walk-in Customer", customer_phone]
                );
                finalCustomerId = newCustomer.insertId;
            }
        }

        const invoice_no = "INV" + Date.now();

        const [sale] = await conn.query(
            `INSERT INTO sales
            (business_id, customer_id, customer_name, customer_phone,
             invoice_no, subtotal, discount, gst_percent,
             cgst, sgst, tax, total_amount,
             payment_method, payment_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                businessId,
                finalCustomerId,
                customer_name || "Walk-in Customer",
                customer_phone || null,
                invoice_no,
                subtotal,
                discountAmount,
                Number(gst),
                cgst,
                sgst,
                tax,
                total_amount,
                payment_method || "Cash",
                payment_status || "Pending"
            ]
        );

        const saleId = sale.insertId;

        // SECOND LOOP: Save sale items and update stock
        for (const item of items) {
            // SECURITY: Re-verify product belongs to this business
            const [product] = await conn.query(
                "SELECT * FROM products WHERE id = ? AND business_id = ?",
                [item.product_id, businessId]
            );

            if (product.length === 0) {
                throw new Error("Product Not Found in this business");
            }

            const enteredQuantity = Number(item.quantity);
            const enteredUnit = item.entered_unit || 'pcs';
            const productUnit = product[0].price_unit || 'pcs';

            const convertedQuantity = convertUnit(enteredQuantity, enteredUnit, productUnit);

            if (convertedQuantity <= 0) {
                throw new Error("Invalid quantity after conversion");
            }

            if (product[0].stock < convertedQuantity) {
                throw new Error(
                    `${product[0].product_name} - Only ${product[0].stock} ${productUnit} available in stock`
                );
            }

            const { totalPrice, unitPrice, convertedQuantity: calcConvertedQty } = calculatePrice(
                product[0],
                enteredQuantity,
                enteredUnit
            );

            const productTaxRate = product[0].tax || Number(gst);
            const itemTax = Number((totalPrice * (productTaxRate / 100)).toFixed(2));
            const itemTotal = Number((totalPrice + itemTax).toFixed(2));

            await conn.query(
                `INSERT INTO sale_items
                (sale_id, product_id, product_name,
                 quantity, entered_quantity, entered_unit,
                 base_quantity, base_price, base_unit,
                 price, tax, total, tax_rate)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    saleId,
                    item.product_id,
                    product[0].product_name,
                    convertedQuantity,
                    enteredQuantity,
                    enteredUnit,
                    convertedQuantity,
                    unitPrice,
                    productUnit,
                    unitPrice,
                    itemTax,
                    itemTotal,
                    productTaxRate
                ]
            );

            await conn.query(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ? AND business_id = ?`,
                [convertedQuantity, item.product_id, businessId]
            );
        }

        // =====================================
        // UPDATE CUSTOMER PURCHASE DETAILS
        // =====================================

        if (finalCustomerId) {
            // SECURITY: Verify customer belongs to this business
            await conn.query(
                `UPDATE customers
                 SET total_orders = total_orders + 1,
                     total_spent = total_spent + ?,
                     last_purchase = NOW()
                 WHERE id = ? AND business_id = ?`,
                [total_amount, finalCustomerId, businessId]
            );
        }

        await conn.commit();

        res.json({
            success: true,
            message: "Sale Created Successfully",
            saleId,
            invoice_no,
            subtotal,
            discount: discountAmount,
            gst_percent: Number(gst),
            cgst,
            sgst,
            tax,
            total_amount
        });

    } catch (err) {
        await conn.rollback();
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        conn.release();
    }
};

// =====================================
// GET SALES - SECURED
// =====================================

exports.getSales = async (req, res) => {
    try {
        // SECURITY: Use businessId from middleware, not from query params
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        const [rows] = await db.query(
            `SELECT
                id, invoice_no, customer_name, customer_phone,
                subtotal, discount, gst_percent, cgst, sgst,
                tax, total_amount, payment_method, payment_status,
                created_at
            FROM sales
            WHERE business_id = ?
            ORDER BY id DESC`,
            [businessId]
        );

        for (const sale of rows) {
            const [items] = await db.query(
                `SELECT
                    product_name, entered_quantity, entered_unit,
                    base_quantity, base_unit, price, total
                 FROM sale_items
                 WHERE sale_id = ?`,
                [sale.id]
            );
            sale.items = items;
        }

        res.json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// GET SALE DETAILS - SECURED
// =====================================

exports.getSale = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        // SECURITY: Verify sale belongs to this business
        const [sale] = await db.query(
            "SELECT * FROM sales WHERE id = ? AND business_id = ?",
            [id, businessId]
        );

        if (sale.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale Not Found"
            });
        }

        const [items] = await db.query(
            `SELECT
                product_name, quantity, entered_quantity, entered_unit,
                base_quantity, base_price, base_unit,
                price, tax, tax_rate, total
            FROM sale_items
            WHERE sale_id = ?`,
            [id]
        );

        res.json({
            success: true,
            sale: sale[0],
            items
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// UPDATE PAYMENT STATUS - SECURED
// =====================================

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        // SECURITY: Only update if sale belongs to this business
        const [result] = await db.query(
            `UPDATE sales
             SET payment_status = ?
             WHERE id = ? AND business_id = ?`,
            [payment_status, id, businessId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found or unauthorized"
            });
        }

        res.json({
            success: true,
            message: "Payment Updated"
        });

    } catch(err){
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// GET INVOICE - SECURED
// =====================================

exports.getInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        // SECURITY: Verify sale belongs to this business
        const [sale] = await db.query(
            `SELECT
                s.*,
                b.business_name, b.owner_name,
                b.phone AS business_phone,
                b.email AS business_email,
                b.address, b.city, b.state,
                b.pincode, b.gst_number, b.logo
            FROM sales s
            LEFT JOIN businesses b ON s.business_id = b.id
            WHERE s.id = ? AND s.business_id = ?`,
            [id, businessId]
        );

        if (sale.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale Not Found"
            });
        }

        const [items] = await db.query(
            `SELECT 
                product_name, quantity, entered_quantity, entered_unit,
                base_quantity, base_price, base_unit,
                price, tax, tax_rate, total
            FROM sale_items 
            WHERE sale_id = ?`,
            [id]
        );

        res.json({
            success: true,
            invoice: sale[0],
            items
        });

    } catch(err){
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// DELETE SALE - SECURED
// =====================================

exports.deleteSale = async (req, res) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const businessId = req.businessId;

        if (!businessId) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        // SECURITY: First verify sale belongs to this business
        const [saleCheck] = await conn.query(
            "SELECT id FROM sales WHERE id = ? AND business_id = ?",
            [id, businessId]
        );

        if (saleCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                success: false,
                message: "Sale not found or unauthorized"
            });
        }

        const [items] = await conn.query(
            "SELECT * FROM sale_items WHERE sale_id = ?",
            [id]
        );

        // Restore stock
        for (const item of items) {
            // SECURITY: Verify product belongs to this business
            await conn.query(
                `UPDATE products
                 SET stock = stock + ?
                 WHERE id = ? AND business_id = ?`,
                [item.quantity, item.product_id, businessId]
            );
        }

        await conn.query(
            "DELETE FROM sale_items WHERE sale_id = ?",
            [id]
        );

        await conn.query(
            "DELETE FROM sales WHERE id = ? AND business_id = ?",
            [id, businessId]
        );

        await conn.commit();

        res.json({
            success: true,
            message: "Sale Deleted Successfully"
        });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        conn.release();
    }
};

// =====================================
// GET SALES REPORT - SECURED
// =====================================

exports.getSalesReport = async (req, res) => {
    try {
        const businessId = req.businessId;
        const { startDate, endDate } = req.query;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        let query = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(tax) as total_tax,
                SUM(discount) as total_discount,
                AVG(total_amount) as average_order_value
            FROM sales
            WHERE business_id = ?
        `;

        const params = [businessId];

        if (startDate && endDate) {
            query += ` AND DATE(created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

        const [report] = await db.query(query, params);

        // Get summary totals
        const [summary] = await db.query(
            `SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(tax) as total_tax,
                SUM(discount) as total_discount,
                AVG(total_amount) as average_order_value
            FROM sales
            WHERE business_id = ?
            ${startDate && endDate ? 'AND DATE(created_at) BETWEEN ? AND ?' : ''}`,
            startDate && endDate ? [businessId, startDate, endDate] : [businessId]
        );

        res.json({
            success: true,
            summary: summary[0],
            report
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};