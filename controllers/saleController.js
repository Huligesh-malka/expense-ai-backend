const db = require("../config/db");

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Convert quantity from one unit to another
 */
const convertUnit = (quantity, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return quantity;

    // Convert compatible units to a common base unit, then to the target unit.
    const toBase = {
        g: 1,
        kg: 1000,
        ml: 1,
        l: 1000,
        pcs: 1,
        dozen: 12,
        meter: 1,
        feet: 0.3048
    };

    const compatibleFamilies = [
        new Set(["g", "kg"]),
        new Set(["ml", "l"]),
        new Set(["pcs", "dozen"]),
        new Set(["meter", "feet"])
    ];

    const compatible = compatibleFamilies.some(
        family => family.has(fromUnit) && family.has(toUnit)
    );

    if (!compatible) return quantity;

    return (quantity * toBase[fromUnit]) / toBase[toUnit];
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
    let conn;

    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const businessId = Number(req.businessId);
        if (!Number.isInteger(businessId) || businessId <= 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

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

        if (!Array.isArray(items) || items.length === 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Please add products."
            });
        }

        const discountPercent = Number(discount);
        const gstPercent = Number(gst);
        if (
            !Number.isFinite(discountPercent) ||
            discountPercent < 0 ||
            discountPercent > 100 ||
            !Number.isFinite(gstPercent) ||
            gstPercent < 0 ||
            gstPercent > 100
        ) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Discount and GST must be valid percentages between 0 and 100."
            });
        }

        const validUnits = new Set([
            "pcs", "g", "kg", "ml", "l", "pack", "box",
            "bottle", "dozen", "meter", "feet"
        ]);

        // DSA: Set removes duplicate product IDs; Map provides average O(1) product lookups.
        const productIds = [...new Set(items.map(item => Number(item.product_id)))];

        if (
            productIds.some(id => !Number.isInteger(id) || id <= 0) ||
            items.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)
        ) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "Each item must have a valid product ID and quantity greater than zero."
            });
        }

        // Fetch all products in one query and lock rows until the transaction completes.
        const placeholders = productIds.map(() => "?").join(",");
        const [productRows] = await conn.query(
            `SELECT *
             FROM products
             WHERE business_id = ?
               AND id IN (${placeholders})
             FOR UPDATE`,
            [businessId, ...productIds]
        );

        const productMap = new Map(
            productRows.map(product => [Number(product.id), product])
        );

        if (productMap.size !== productIds.length) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: "One or more products were not found in this business."
            });
        }

        // Validate and price all lines before inserting the invoice.
        const preparedItems = [];
        const requiredStockByProduct = new Map();
        let subtotal = 0;

        for (const item of items) {
            const productId = Number(item.product_id);
            const product = productMap.get(productId);
            const quantity = Number(item.quantity);
            const enteredUnit = item.entered_unit || "pcs";
            const productUnit = product.price_unit || "pcs";

            if (!validUnits.has(enteredUnit)) {
                throw new Error(`Invalid unit: ${enteredUnit}`);
            }

            if (product.status !== "active") {
                throw new Error(`${product.product_name} is inactive and cannot be sold.`);
            }

            // Unit conversion is only valid within compatible measurement families.
            const weightUnits = new Set(["g", "kg"]);
            const volumeUnits = new Set(["ml", "l"]);
            const countUnits = new Set(["pcs", "dozen"]);
            const lengthUnits = new Set(["meter", "feet"]);
            const sameFamily =
                enteredUnit === productUnit ||
                (weightUnits.has(enteredUnit) && weightUnits.has(productUnit)) ||
                (volumeUnits.has(enteredUnit) && volumeUnits.has(productUnit)) ||
                (countUnits.has(enteredUnit) && countUnits.has(productUnit)) ||
                (lengthUnits.has(enteredUnit) && lengthUnits.has(productUnit));

            if (!sameFamily) {
                throw new Error(
                    `Cannot convert ${enteredUnit} to ${productUnit} for ${product.product_name}.`
                );
            }

            const { totalPrice, unitPrice, convertedQuantity } = calculatePrice(
                product,
                quantity,
                enteredUnit
            );

            if (
                !Number.isFinite(convertedQuantity) ||
                convertedQuantity <= 0 ||
                !Number.isFinite(totalPrice)
            ) {
                throw new Error(`Invalid quantity or price for ${product.product_name}.`);
            }

            subtotal += totalPrice;
            requiredStockByProduct.set(
                productId,
                (requiredStockByProduct.get(productId) || 0) + convertedQuantity
            );

            preparedItems.push({
                productId,
                product,
                quantity,
                enteredUnit,
                productUnit,
                convertedQuantity,
                unitPrice,
                lineSubtotal: totalPrice,
                taxRate: Number(product.tax) > 0 ? Number(product.tax) : gstPercent
            });
        }

        // Validate combined quantities too, so duplicate product lines cannot oversell stock.
        for (const [productId, requiredQuantity] of requiredStockByProduct) {
            const product = productMap.get(productId);
            if (Number(product.stock) < requiredQuantity) {
                throw new Error(
                    `${product.product_name} - only ${product.stock} ${product.price_unit || "pcs"} available in stock.`
                );
            }
        }

        subtotal = Number(subtotal.toFixed(2));
        const discountAmount = Number((subtotal * discountPercent / 100).toFixed(2));

        // Calculate tax per line so product-specific tax rates are reflected in the invoice.
        let tax = 0;
        for (const line of preparedItems) {
            line.discountShare = subtotal > 0
                ? Number((discountAmount * line.lineSubtotal / subtotal).toFixed(2))
                : 0;
            line.taxableAmount = Math.max(0, line.lineSubtotal - line.discountShare);
            line.itemTax = Number((line.taxableAmount * line.taxRate / 100).toFixed(2));
            line.itemTotal = Number((line.taxableAmount + line.itemTax).toFixed(2));
            tax += line.itemTax;
        }

        tax = Number(tax.toFixed(2));
        const total_amount = Number((subtotal - discountAmount + tax).toFixed(2));
        const cgst = Number((tax / 2).toFixed(2));
        const sgst = Number((tax - cgst).toFixed(2));

        let finalCustomerId = customer_id ? Number(customer_id) : null;

        if (finalCustomerId) {
            const [customerRows] = await conn.query(
                "SELECT id FROM customers WHERE id = ? AND business_id = ? LIMIT 1",
                [finalCustomerId, businessId]
            );
            if (customerRows.length === 0) {
                throw new Error("Customer not found in this business.");
            }
        }

        if (customer_phone && String(customer_phone).trim() !== "") {
            const phone = String(customer_phone).trim();
            const [existingCustomer] = await conn.query(
                `SELECT id FROM customers
                 WHERE business_id = ? AND customer_phone = ?
                 LIMIT 1`,
                [businessId, phone]
            );

            if (existingCustomer.length > 0) {
                finalCustomerId = existingCustomer[0].id;
            } else {
                const [newCustomer] = await conn.query(
                    `INSERT INTO customers (business_id, customer_name, customer_phone)
                     VALUES (?, ?, ?)`,
                    [businessId, customer_name || "Walk-in Customer", phone]
                );
                finalCustomerId = newCustomer.insertId;
            }
        }

        const invoice_no = `INV${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

        const [sale] = await conn.query(
            `INSERT INTO sales
             (business_id, customer_id, customer_name, customer_phone,
              invoice_no, subtotal, discount, gst_percent,
              cgst, sgst, tax, total_amount,
              payment_method, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                businessId,
                finalCustomerId,
                customer_name || "Walk-in Customer",
                customer_phone || null,
                invoice_no,
                subtotal,
                discountAmount,
                gstPercent,
                cgst,
                sgst,
                tax,
                total_amount,
                payment_method || "Cash",
                payment_status || "Pending"
            ]
        );

        const saleId = sale.insertId;

        for (const line of preparedItems) {
            await conn.query(
                `INSERT INTO sale_items
                 (sale_id, product_id, product_name,
                  quantity, entered_quantity, entered_unit,
                  base_quantity, base_price, base_unit,
                  price, tax, total, tax_rate)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    saleId,
                    line.productId,
                    line.product.product_name,
                    line.convertedQuantity,
                    line.quantity,
                    line.enteredUnit,
                    line.convertedQuantity,
                    line.unitPrice,
                    line.productUnit,
                    line.unitPrice,
                    line.itemTax,
                    line.itemTotal,
                    line.taxRate
                ]
            );
        }

        // Atomic stock decrement with a stock guard as an additional safety check.
        for (const [productId, requiredQuantity] of requiredStockByProduct) {
            const [stockUpdate] = await conn.query(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ? AND business_id = ? AND stock >= ?`,
                [requiredQuantity, productId, businessId, requiredQuantity]
            );

            if (stockUpdate.affectedRows !== 1) {
                throw new Error(`Stock changed while processing product ID ${productId}. Please retry the sale.`);
            }
        }

        if (finalCustomerId) {
            await conn.query(
                `UPDATE customers
                 SET total_orders = COALESCE(total_orders, 0) + 1,
                     total_spent = COALESCE(total_spent, 0) + ?,
                     last_purchase = NOW()
                 WHERE id = ? AND business_id = ?`,
                [total_amount, finalCustomerId, businessId]
            );
        }

        await conn.commit();

        return res.status(201).json({
            success: true,
            message: "Sale Created Successfully",
            saleId,
            invoice_no,
            subtotal,
            discount: discountAmount,
            gst_percent: gstPercent,
            cgst,
            sgst,
            tax,
            total_amount
        });
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackError) {
                console.error("Sale rollback error:", rollbackError);
            }
        }

        console.error("Create Sale Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to create sale"
        });
    } finally {
        if (conn) conn.release();
    }
};

// =====================================
// GET SALES - SECURED
// =====================================

exports.getSales = async (req, res) => {
    try {
        const businessId = Number(req.businessId);

        if (!Number.isInteger(businessId) || businessId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        // Pagination prevents loading every sale and its items into memory at once.
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        const [[countRow]] = await db.query(
            "SELECT COUNT(*) AS total FROM sales WHERE business_id = ?",
            [businessId]
        );

        const [sales] = await db.query(
            `SELECT
                id, invoice_no, customer_name, customer_phone,
                subtotal, discount, gst_percent, cgst, sgst,
                tax, total_amount, payment_method, payment_status,
                created_at
             FROM sales
             WHERE business_id = ?
             ORDER BY id DESC
             LIMIT ? OFFSET ?`,
            [businessId, limit, offset]
        );

        // One query for all items on this page avoids the N+1 query pattern.
        if (sales.length > 0) {
            const saleIds = sales.map(sale => sale.id);
            const placeholders = saleIds.map(() => "?").join(",");

            const [items] = await db.query(
                `SELECT
                    sale_id,
                    product_name,
                    entered_quantity,
                    entered_unit,
                    base_quantity,
                    base_unit,
                    price,
                    total
                 FROM sale_items
                 WHERE sale_id IN (${placeholders})
                 ORDER BY id ASC`,
                saleIds
            );

            const itemsBySaleId = new Map();
            for (const item of items) {
                if (!itemsBySaleId.has(item.sale_id)) {
                    itemsBySaleId.set(item.sale_id, []);
                }
                itemsBySaleId.get(item.sale_id).push(item);
            }

            for (const sale of sales) {
                sale.items = itemsBySaleId.get(sale.id) || [];
            }
        } else {
            for (const sale of sales) sale.items = [];
        }

        return res.json({
            success: true,
            total: Number(countRow.total) || 0,
            page,
            limit,
            totalPages: Math.ceil((Number(countRow.total) || 0) / limit),
            data: sales
        });
    } catch (err) {
        console.error("Get Sales Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch sales",
            error: err.message
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
