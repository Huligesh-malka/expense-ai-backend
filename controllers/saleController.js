const db = require("../config/db");

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Convert quantity from one unit to another
 * @param {number} quantity - The quantity to convert
 * @param {string} fromUnit - The unit to convert from (g, kg, ml, l, pcs, dozen)
 * @param {string} toUnit - The unit to convert to (g, kg, ml, l, pcs, dozen)
 * @returns {number} - The converted quantity
 */
const convertUnit = (quantity, fromUnit, toUnit) => {
    // If units are the same, no conversion needed
    if (fromUnit === toUnit) return quantity;

    // Convert to base unit first (g, ml, pcs)
    let quantityInBase = quantity;

    // Convert from unit to base
    if (fromUnit === 'kg') {
        quantityInBase = quantity * 1000; // kg to g
    } else if (fromUnit === 'l') {
        quantityInBase = quantity * 1000; // l to ml
    } else if (fromUnit === 'dozen') {
        quantityInBase = quantity * 12; // dozen to pcs
    }
    // g, ml, pcs are already in base

    // Convert from base to target unit
    let result = quantityInBase;
    if (toUnit === 'kg') {
        result = quantityInBase / 1000; // g to kg
    } else if (toUnit === 'l') {
        result = quantityInBase / 1000; // ml to l
    } else if (toUnit === 'dozen') {
        result = quantityInBase / 12; // pcs to dozen
    }
    // g, ml, pcs are already in base

    return result;
};

/**
 * Calculate price based on product and quantity
 * @param {Object} product - Product object from database
 * @param {number} quantity - Entered quantity
 * @param {string} enteredUnit - Unit of entered quantity
 * @returns {Object} - { totalPrice, unitPrice }
 */
const calculatePrice = (product, quantity, enteredUnit) => {
    let totalPrice = 0;
    let unitPrice = 0;

    // Get base unit from product
    const productUnit = product.price_unit || 'pcs';
    const pricePerUnit = product.selling_price / product.price_per;

    // Convert entered quantity to product's unit
    const convertedQuantity = convertUnit(quantity, enteredUnit, productUnit);
    
    // Calculate total price
    totalPrice = convertedQuantity * pricePerUnit;
    unitPrice = pricePerUnit;

    // Round to 2 decimal places
    totalPrice = Number(totalPrice.toFixed(2));
    unitPrice = Number(unitPrice.toFixed(2));

    return { totalPrice, unitPrice, convertedQuantity };
};

// =====================================
// CREATE SALE
// =====================================

exports.createSale = async (req, res) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const {
            business_id,
            customer_id,
            customer_name,
            customer_phone,
            payment_method,
            payment_status,
            discount = 0,
            gst = 18,
            items
        } = req.body;

        // Validation: Business ID
        if (!business_id) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Business ID Required"
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

        // Valid units list
        const validUnits = [
            "pcs", "g", "kg", "ml", "l",
            "pack", "box", "bottle",
            "dozen", "meter", "feet"
        ];

        let subtotal = 0;

        // FIRST LOOP: Validate items and calculate subtotal
        for (const item of items) {
            // Validation: Quantity
            if (Number(item.quantity) <= 0) {
                throw new Error("Quantity must be greater than 0");
            }

            // Validation: Entered unit
            const enteredUnit = item.entered_unit || "pcs";
            if (!validUnits.includes(enteredUnit)) {
                throw new Error(`Invalid unit: ${enteredUnit}`);
            }

            const [product] = await conn.query(
                "SELECT * FROM products WHERE id=?",
                [item.product_id]
            );

            if (product.length === 0) {
                throw new Error(`Product with ID ${item.product_id} not found`);
            }

            // Validation: Product status
            if (product[0].status !== "active") {
                throw new Error(
                    `${product[0].product_name} is inactive and cannot be sold`
                );
            }

            // Calculate price using helper
            const { totalPrice } = calculatePrice(
                product[0],
                Number(item.quantity),
                enteredUnit
            );

            subtotal += totalPrice;
        }

        // Round subtotal
        subtotal = Number(subtotal.toFixed(2));

        const discountAmount = Number((subtotal * (Number(discount) / 100)).toFixed(2));
        const taxableAmount = Number((subtotal - discountAmount).toFixed(2));
        const tax = Number((taxableAmount * (Number(gst) / 100)).toFixed(2));
        const total_amount = Number((taxableAmount + tax).toFixed(2));

        // Calculate CGST and SGST (half of GST each)
        const cgst = Number((tax / 2).toFixed(2));
        const sgst = Number((tax / 2).toFixed(2));

        // =====================================
        // FIND OR CREATE CUSTOMER
        // =====================================

        let finalCustomerId = customer_id || null;

        if (customer_phone && customer_phone.trim() !== "") {

            const [existingCustomer] = await conn.query(
                `SELECT id
                 FROM customers
                 WHERE business_id = ?
                 AND customer_phone = ?`,
                [
                    business_id,
                    customer_phone
                ]
            );

            if (existingCustomer.length > 0) {

                finalCustomerId = existingCustomer[0].id;

            } else {

                const [newCustomer] = await conn.query(
                    `INSERT INTO customers
                    (
                        business_id,
                        customer_name,
                        customer_phone
                    )
                    VALUES
                    (?, ?, ?)`,
                    [
                        business_id,
                        customer_name || "Walk-in Customer",
                        customer_phone
                    ]
                );

                finalCustomerId = newCustomer.insertId;

            }

        }

        const invoice_no = "INV" + Date.now();

        const [sale] = await conn.query(
            `INSERT INTO sales
            (
                business_id,
                customer_id,
                customer_name,
                customer_phone,
                invoice_no,
                subtotal,
                discount,
                gst_percent,
                cgst,
                sgst,
                tax,
                total_amount,
                payment_method,
                payment_status
            )
            VALUES
            (
                ?,?,?,?,?,?,?,?,?,?,?,?,?,?
            )`,
            [
                business_id,
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
            const [product] = await conn.query(
                "SELECT * FROM products WHERE id=?",
                [item.product_id]
            );

            if (product.length === 0) {
                throw new Error("Product Not Found");
            }

            const enteredQuantity = Number(item.quantity);
            const enteredUnit = item.entered_unit || 'pcs';
            const productUnit = product[0].price_unit || 'pcs';

            // Convert entered quantity to product's unit for stock checking
            const convertedQuantity = convertUnit(enteredQuantity, enteredUnit, productUnit);

            // Validation: Check converted quantity
            if (convertedQuantity <= 0) {
                throw new Error("Invalid quantity after conversion");
            }

            // Check stock using converted quantity
            if (product[0].stock < convertedQuantity) {
                throw new Error(
                    `${product[0].product_name} - Only ${product[0].stock} ${productUnit} available in stock`
                );
            }

            // Calculate price using helper (returns convertedQuantity too)
            const { totalPrice, unitPrice, convertedQuantity: calcConvertedQty } = calculatePrice(
                product[0],
                enteredQuantity,
                enteredUnit
            );

            // Calculate item tax using product's tax rate if available, otherwise use global GST
            const productTaxRate = product[0].tax || Number(gst);
            const itemTax = Number((totalPrice * (productTaxRate / 100)).toFixed(2));
            const itemTotal = Number((totalPrice + itemTax).toFixed(2));

            // FIXED: Now saving base_quantity and correct base_price
            await conn.query(
                `INSERT INTO sale_items
                (
                    sale_id,
                    product_id,
                    product_name,
                    quantity,
                    entered_quantity,
                    entered_unit,
                    base_quantity,
                    base_price,
                    base_unit,
                    price,
                    tax,
                    total,
                    tax_rate
                )
                VALUES
                (
                    ?,?,?,?,?,?,?,?,?,?,?,?,?
                )`,
                [
                    saleId,
                    item.product_id,
                    product[0].product_name,
                    convertedQuantity,          // quantity in product's unit
                    enteredQuantity,            // quantity as entered by user
                    enteredUnit,                // unit as entered by user
                    convertedQuantity,          // base_quantity (same as converted)
                    unitPrice,                  // Store unit price, not selling_price
                    productUnit,                // base_unit (product's unit)
                    unitPrice,                  // price (unit price)
                    itemTax,
                    itemTotal,
                    productTaxRate
                ]
            );

            // Update stock using converted quantity
            await conn.query(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id=?`,
                [
                    convertedQuantity,
                    item.product_id
                ]
            );
        }

        // =====================================
        // UPDATE CUSTOMER PURCHASE DETAILS
        // =====================================

        if (finalCustomerId) {

            await conn.query(
                `UPDATE customers
                 SET
                    total_orders = total_orders + 1,
                    total_spent = total_spent + ?,
                    last_purchase = NOW()
                 WHERE id = ?`,
                [
                    total_amount,
                    finalCustomerId
                ]
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
// GET SALES
// =====================================

exports.getSales = async (req, res) => {
    try {
        const businessId = req.query.business_id;

        const [rows] = await db.query(
            `SELECT
                id,
                invoice_no,
                customer_name,
                customer_phone,
                subtotal,
                discount,
                gst_percent,
                cgst,
                sgst,
                tax,
                total_amount,
                payment_method,
                payment_status,
                created_at
            FROM sales
            WHERE business_id=?
            ORDER BY id DESC`,
            [businessId]
        );

        // Load items for every sale
        for (const sale of rows) {
            const [items] = await db.query(
                `SELECT
                    product_name,
                    entered_quantity,
                    entered_unit,
                    base_quantity,
                    base_unit,
                    price,
                    total
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
// GET SALE DETAILS
// =====================================

exports.getSale = async (req, res) => {
    try {
        const { id } = req.params;

        const [sale] = await db.query(
            "SELECT * FROM sales WHERE id=?",
            [id]
        );

        if (sale.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale Not Found"
            });
        }

        const [items] = await db.query(
            `SELECT
                product_name,
                quantity,
                entered_quantity,
                entered_unit,
                base_quantity,
                base_price,
                base_unit,
                price,
                tax,
                tax_rate,
                total
            FROM sale_items
            WHERE sale_id=?`,
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
// UPDATE PAYMENT STATUS
// =====================================

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        await db.query(
            `UPDATE sales
             SET payment_status=?
             WHERE id=?`,
            [
                payment_status,
                id
            ]
        );

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
// GET INVOICE (UPDATED WITH BUSINESS DETAILS)
// =====================================

exports.getInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        // UPDATED: Join with businesses table to get business details
        const [sale] = await db.query(
            `SELECT
                s.*,
                b.business_name,
                b.owner_name,
                b.phone AS business_phone,
                b.email AS business_email,
                b.address,
                b.city,
                b.state,
                b.pincode,
                b.gst_number,
                b.logo
            FROM sales s
            LEFT JOIN businesses b
                ON s.business_id = b.id
            WHERE s.id = ?`,
            [id]
        );

        if (sale.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale Not Found"
            });
        }

        const [items] = await db.query(
            `SELECT 
                product_name,
                quantity,
                entered_quantity,
                entered_unit,
                base_quantity,
                base_price,
                base_unit,
                price,
                tax,
                tax_rate,
                total
            FROM sale_items 
            WHERE sale_id=?`,
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
// DELETE SALE
// =====================================

exports.deleteSale = async (req, res) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const { id } = req.params;

        const [items] = await conn.query(
            "SELECT * FROM sale_items WHERE sale_id=?",
            [id]
        );

        // Restore stock using converted quantity
        for (const item of items) {
            await conn.query(
                `UPDATE products
                 SET stock = stock + ?
                 WHERE id=?`,
                [
                    item.quantity, // quantity already stores converted value
                    item.product_id
                ]
            );
        }

        await conn.query(
            "DELETE FROM sale_items WHERE sale_id=?",
            [id]
        );

        await conn.query(
            "DELETE FROM sales WHERE id=?",
            [id]
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