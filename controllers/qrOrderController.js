const db = require("../config/db");
const crypto = require("crypto");

// ============================================
// HELPERS
// ============================================

const generateToken = () => {
    return crypto.randomBytes(32).toString("hex");
};

const generateOrderNumber = () => {
    const time = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);

    return `QR${time}${random}`;
};


// ============================================
// GET / CREATE BUSINESS QR
// OWNER ONLY
// ============================================

exports.getOrCreateQR = async (req, res) => {
    try {
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        let [rows] = await db.query(
            `SELECT
                id,
                business_id,
                qr_token,
                status,
                created_at
             FROM qr_menus
             WHERE business_id = ?
             LIMIT 1`,
            [businessId]
        );

        if (rows.length === 0) {

            const token = generateToken();

            await db.query(
                `INSERT INTO qr_menus
                (
                    business_id,
                    qr_token,
                    status
                )
                VALUES (?, ?, 'active')`,
                [
                    businessId,
                    token
                ]
            );

            [rows] = await db.query(
                `SELECT
                    id,
                    business_id,
                    qr_token,
                    status,
                    created_at
                 FROM qr_menus
                 WHERE business_id = ?
                 LIMIT 1`,
                [businessId]
            );
        }

        const qr = rows[0];

        res.json({
            success: true,
            data: {
                id: qr.id,
                business_id: qr.business_id,
                qr_token: qr.qr_token,
                status: qr.status,

                // Change this to your real frontend domain
                qr_url: `${process.env.FRONTEND_URL}/qr/${qr.qr_token}`
            }
        });

    } catch (err) {
        console.error("Get/Create QR Error:", err);

        res.status(500).json({
            success: false,
            message: err.message || "Failed to create QR"
        });
    }
};


// ============================================
// UPDATE QR STATUS
// OWNER ONLY
// ============================================

exports.updateQRStatus = async (req, res) => {
    try {
        const businessId = req.businessId;
        const { status } = req.body;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid QR status"
            });
        }

        const [result] = await db.query(
            `UPDATE qr_menus
             SET status = ?
             WHERE business_id = ?`,
            [
                status,
                businessId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "QR menu not found"
            });
        }

        res.json({
            success: true,
            message: `QR menu ${status}`
        });

    } catch (err) {
        console.error("Update QR Status Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// CREATE TABLE
// OWNER ONLY
// ============================================

exports.createTable = async (req, res) => {
    try {
        const businessId = req.businessId;

        const {
            table_number,
            table_name
        } = req.body;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }

        if (!table_number) {
            return res.status(400).json({
                success: false,
                message: "Table number is required"
            });
        }

        const [existing] = await db.query(
            `SELECT id
             FROM restaurant_tables
             WHERE business_id = ?
             AND table_number = ?`,
            [
                businessId,
                table_number
            ]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Table already exists"
            });
        }

        const [result] = await db.query(
            `INSERT INTO restaurant_tables
            (
                business_id,
                table_number,
                table_name
            )
            VALUES (?, ?, ?)`,
            [
                businessId,
                table_number,
                table_name || null
            ]
        );

        const [table] = await db.query(
            `SELECT *
             FROM restaurant_tables
             WHERE id = ?
             AND business_id = ?`,
            [
                result.insertId,
                businessId
            ]
        );

        res.status(201).json({
            success: true,
            message: "Table created successfully",
            data: table[0]
        });

    } catch (err) {
        console.error("Create Table Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// GET ALL TABLES
// OWNER ONLY
// ============================================

exports.getTables = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [tables] = await db.query(
            `SELECT
                id,
                table_number,
                table_name,
                status,
                created_at
             FROM restaurant_tables
             WHERE business_id = ?
             ORDER BY table_number ASC`,
            [businessId]
        );

        res.json({
            success: true,
            total: tables.length,
            data: tables
        });

    } catch (err) {
        console.error("Get Tables Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// UPDATE TABLE
// OWNER ONLY
// ============================================

exports.updateTable = async (req, res) => {
    try {
        const businessId = req.businessId;
        const { id } = req.params;

        const {
            table_number,
            table_name,
            status
        } = req.body;

        const [existing] = await db.query(
            `SELECT *
             FROM restaurant_tables
             WHERE id = ?
             AND business_id = ?`,
            [
                id,
                businessId
            ]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        await db.query(
            `UPDATE restaurant_tables
             SET
                table_number = ?,
                table_name = ?,
                status = ?
             WHERE id = ?
             AND business_id = ?`,
            [
                table_number || existing[0].table_number,
                table_name ?? existing[0].table_name,
                status || existing[0].status,
                id,
                businessId
            ]
        );

        res.json({
            success: true,
            message: "Table updated successfully"
        });

    } catch (err) {
        console.error("Update Table Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// DELETE TABLE
// OWNER ONLY
// ============================================

exports.deleteTable = async (req, res) => {
    try {
        const businessId = req.businessId;
        const { id } = req.params;

        const [result] = await db.query(
            `DELETE FROM restaurant_tables
             WHERE id = ?
             AND business_id = ?`,
            [
                id,
                businessId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        res.json({
            success: true,
            message: "Table deleted successfully"
        });

    } catch (err) {
        console.error("Delete Table Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// PUBLIC QR MENU
//
// Customer scans QR.
// NO OWNER LOGIN REQUIRED.
// ============================================

exports.getPublicMenu = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "QR token is required"
            });
        }

        // Get QR + business
        const [qrRows] = await db.query(
            `SELECT
                q.id,
                q.business_id,
                q.qr_token,
                q.status AS qr_status,

                b.business_name,
                b.owner_name,
                b.phone AS business_phone,
                b.email AS business_email,
                b.address,
                b.city,
                b.state,
                b.pincode,
                b.logo

             FROM qr_menus q

             INNER JOIN businesses b
             ON b.id = q.business_id

             WHERE q.qr_token = ?
             AND q.status = 'active'

             LIMIT 1`,
            [token]
        );

        if (qrRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "QR menu not found or inactive"
            });
        }

        const qr = qrRows[0];

        // Get active tables
        const [tables] = await db.query(
            `SELECT
                id,
                table_number,
                table_name
             FROM restaurant_tables
             WHERE business_id = ?
             AND status = 'active'
             ORDER BY table_number ASC`,
            [qr.business_id]
        );

        // Get ONLY QR enabled products
        const [products] = await db.query(
            `SELECT
                id,
                category,
                product_name,
                product_code,

                selling_price,
                price_per,
                price_unit,

                tax,
                image,
                description,

                status

             FROM products

             WHERE business_id = ?
             AND status = 'active'
             AND qr_enabled = TRUE

             ORDER BY category ASC, product_name ASC`,
            [qr.business_id]
        );

        res.json({
            success: true,

            business: {
                id: qr.business_id,
                business_name: qr.business_name,
                owner_name: qr.owner_name,
                phone: qr.business_phone,
                email: qr.business_email,
                address: qr.address,
                city: qr.city,
                state: qr.state,
                pincode: qr.pincode,
                logo: qr.logo
            },

            tables,

            products
        });

    } catch (err) {
        console.error("Public QR Menu Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load QR menu"
        });
    }
};


// ============================================
// CREATE QR ORDER
//
// CUSTOMER PUBLIC API
// ============================================

exports.createQROrder = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            qr_token,
            table_id,
            customer_name,
            customer_phone,
            notes,
            items
        } = req.body;

        // =====================================
        // VALIDATION
        // =====================================

        if (!qr_token) {
            throw new Error("QR token is required");
        }

        if (!table_id) {
            throw new Error("Table is required");
        }

        if (!Array.isArray(items) || items.length === 0) {
            throw new Error("Please add at least one product");
        }


        // =====================================
        // VERIFY QR
        // =====================================

        const [qrRows] = await connection.query(
            `SELECT
                id,
                business_id
             FROM qr_menus
             WHERE qr_token = ?
             AND status = 'active'
             LIMIT 1`,
            [qr_token]
        );

        if (qrRows.length === 0) {
            throw new Error("Invalid or inactive QR code");
        }

        const businessId = qrRows[0].business_id;


        // =====================================
        // VERIFY TABLE
        // =====================================

        const [tableRows] = await connection.query(
            `SELECT
                id,
                table_number,
                table_name
             FROM restaurant_tables
             WHERE id = ?
             AND business_id = ?
             AND status = 'active'
             LIMIT 1`,
            [
                table_id,
                businessId
            ]
        );

        if (tableRows.length === 0) {
            throw new Error("Invalid table");
        }


        // =====================================
        // CALCULATE ORDER
        // =====================================

        let subtotal = 0;
        let taxTotal = 0;

        const orderItems = [];


        for (const item of items) {

            const productId = Number(item.product_id);
            const quantity = Number(item.quantity);

            if (!productId || quantity <= 0) {
                throw new Error("Invalid product or quantity");
            }


            // IMPORTANT:
            // Customer can ONLY order QR-enabled products
            const [productRows] = await connection.query(
                `SELECT
                    id,
                    product_name,
                    selling_price,
                    price_per,
                    price_unit,
                    stock,
                    tax,
                    status,
                    qr_enabled

                 FROM products

                 WHERE id = ?
                 AND business_id = ?
                 AND status = 'active'
                 AND qr_enabled = TRUE

                 FOR UPDATE`,
                [
                    productId,
                    businessId
                ]
            );


            if (productRows.length === 0) {
                throw new Error(
                    `Product ${productId} is not available in QR menu`
                );
            }


            const product = productRows[0];


            // =================================
            // STOCK CHECK
            // =================================

            if (Number(product.stock) < quantity) {

                throw new Error(
                    `${product.product_name} - Only ${product.stock} ${product.price_unit || "pcs"} available`
                );
            }


            // =================================
            // PRICE
            // =================================

            const pricePerUnit =
                Number(product.selling_price) /
                Number(product.price_per || 1);

            const baseTotal =
                quantity * pricePerUnit;


            // =================================
            // TAX
            // =================================

            const taxRate = Number(product.tax || 0);

            const taxAmount =
                baseTotal * (taxRate / 100);


            const itemTotal =
                baseTotal + taxAmount;


            subtotal += baseTotal;
            taxTotal += taxAmount;


            orderItems.push({
                product_id: product.id,
                product_name: product.product_name,

                quantity,
                unit: product.price_unit || "pcs",

                unit_price: Number(pricePerUnit.toFixed(2)),

                tax_rate: taxRate,
                tax_amount: Number(taxAmount.toFixed(2)),

                total: Number(itemTotal.toFixed(2)),

                notes: item.notes || null
            });
        }


        subtotal = Number(subtotal.toFixed(2));
        taxTotal = Number(taxTotal.toFixed(2));

        const totalAmount =
            Number((subtotal + taxTotal).toFixed(2));


        // =====================================
        // ORDER NUMBER
        // =====================================

        const orderNo = generateOrderNumber();


        // =====================================
        // CREATE ORDER
        // =====================================

        const [orderResult] = await connection.query(
            `INSERT INTO qr_orders
            (
                business_id,
                table_id,
                order_no,

                customer_name,
                customer_phone,

                subtotal,
                discount,
                tax,
                total_amount,

                order_status,
                payment_status,

                stock_deducted,
                notes
            )
            VALUES
            (?, ?, ?, ?, ?, ?, 0, ?, ?, 'new', 'pending', FALSE, ?)`,
            [
                businessId,
                table_id,
                orderNo,

                customer_name || null,
                customer_phone || null,

                subtotal,
                taxTotal,
                totalAmount,

                notes || null
            ]
        );


        const orderId = orderResult.insertId;


        // =====================================
        // INSERT ORDER ITEMS
        // =====================================

        for (const item of orderItems) {

            await connection.query(
                `INSERT INTO qr_order_items
                (
                    order_id,
                    product_id,
                    product_name,

                    quantity,
                    unit,

                    unit_price,

                    tax_rate,
                    tax_amount,

                    total,
                    notes
                )
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,

                    item.product_id,
                    item.product_name,

                    item.quantity,
                    item.unit,

                    item.unit_price,

                    item.tax_rate,
                    item.tax_amount,

                    item.total,
                    item.notes
                ]
            );
        }


        await connection.commit();


        res.status(201).json({
            success: true,

            message: "Order placed successfully",

            data: {
                order_id: orderId,
                order_no: orderNo,

                table_id,
                table_number: tableRows[0].table_number,

                subtotal,
                tax: taxTotal,
                total_amount: totalAmount,

                order_status: "new",
                payment_status: "pending"
            }
        });


    } catch (err) {

        await connection.rollback();

        console.error("Create QR Order Error:", err);

        res.status(400).json({
            success: false,
            message: err.message
        });

    } finally {

        connection.release();
    }
};


// ============================================
// OWNER - GET QR ORDERS
// ============================================

exports.getQROrders = async (req, res) => {

    try {

        const businessId = req.businessId;

        const {
            status,
            table_id
        } = req.query;


        let query = `
            SELECT
                q.id,
                q.order_no,

                q.business_id,
                q.table_id,

                t.table_number,
                t.table_name,

                q.customer_name,
                q.customer_phone,

                q.subtotal,
                q.discount,
                q.tax,
                q.total_amount,

                q.order_status,
                q.payment_method,
                q.payment_status,

                q.stock_deducted,

                q.notes,

                q.created_at,
                q.updated_at

            FROM qr_orders q

            INNER JOIN restaurant_tables t
            ON t.id = q.table_id
            AND t.business_id = q.business_id

            WHERE q.business_id = ?
        `;

        const params = [businessId];


        if (status) {
            query += ` AND q.order_status = ?`;
            params.push(status);
        }


        if (table_id) {
            query += ` AND q.table_id = ?`;
            params.push(table_id);
        }


        query += `
            ORDER BY q.created_at DESC
        `;


        const [orders] = await db.query(
            query,
            params
        );


        // Get items for every order
        for (const order of orders) {

            const [items] = await db.query(
                `SELECT
                    id,
                    product_id,
                    product_name,

                    quantity,
                    unit,

                    unit_price,

                    tax_rate,
                    tax_amount,

                    total,
                    notes

                 FROM qr_order_items

                 WHERE order_id = ?

                 ORDER BY id ASC`,
                [order.id]
            );

            order.items = items;
        }


        res.json({
            success: true,
            total: orders.length,
            data: orders
        });


    } catch (err) {

        console.error("Get QR Orders Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// OWNER - GET SINGLE QR ORDER
// ============================================

exports.getQROrder = async (req, res) => {

    try {

        const businessId = req.businessId;
        const { id } = req.params;


        const [orders] = await db.query(
            `SELECT
                q.*,

                t.table_number,
                t.table_name

             FROM qr_orders q

             INNER JOIN restaurant_tables t
             ON t.id = q.table_id

             WHERE q.id = ?
             AND q.business_id = ?

             LIMIT 1`,
            [
                id,
                businessId
            ]
        );


        if (orders.length === 0) {

            return res.status(404).json({
                success: false,
                message: "QR order not found"
            });
        }


        const order = orders[0];


        const [items] = await db.query(
            `SELECT *
             FROM qr_order_items
             WHERE order_id = ?
             ORDER BY id ASC`,
            [id]
        );


        order.items = items;


        res.json({
            success: true,
            data: order
        });


    } catch (err) {

        console.error("Get QR Order Error:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ============================================
// OWNER - UPDATE QR ORDER STATUS
//
// new
// accepted
// preparing
// ready
// served
// completed
// rejected
// cancelled
// ============================================

exports.updateQROrderStatus = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();


        const businessId = req.businessId;
        const { id } = req.params;
        const { status } = req.body;


        const validStatuses = [
            "new",
            "accepted",
            "preparing",
            "ready",
            "served",
            "completed",
            "rejected",
            "cancelled"
        ];


        if (!validStatuses.includes(status)) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid order status"
            });
        }


        // =====================================
        // GET ORDER
        // =====================================

        const [orders] = await connection.query(
            `SELECT *
             FROM qr_orders
             WHERE id = ?
             AND business_id = ?

             FOR UPDATE`,
            [
                id,
                businessId
            ]
        );


        if (orders.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "QR order not found"
            });
        }


        const order = orders[0];


        // =====================================
        // GET ITEMS
        // =====================================

        const [items] = await connection.query(
            `SELECT *
             FROM qr_order_items
             WHERE order_id = ?`,
            [id]
        );


        // =====================================
        // ACCEPT ORDER
        //
        // Deduct stock ONCE
        // =====================================

        if (
            status === "accepted" &&
            !order.stock_deducted
        ) {

            for (const item of items) {

                const [productRows] = await connection.query(
                    `SELECT
                        id,
                        product_name,
                        stock,
                        status,
                        qr_enabled

                     FROM products

                     WHERE id = ?
                     AND business_id = ?

                     FOR UPDATE`,
                    [
                        item.product_id,
                        businessId
                    ]
                );


                if (productRows.length === 0) {

                    throw new Error(
                        `${item.product_name} no longer exists`
                    );
                }


                const product = productRows[0];


                if (product.status !== "active") {

                    throw new Error(
                        `${product.product_name} is inactive`
                    );
                }


                if (
                    Number(product.stock) <
                    Number(item.quantity)
                ) {

                    throw new Error(
                        `${product.product_name} - Only ${product.stock} available`
                    );
                }


                await connection.query(
                    `UPDATE products
                     SET stock = stock - ?
                     WHERE id = ?
                     AND business_id = ?`,
                    [
                        item.quantity,
                        item.product_id,
                        businessId
                    ]
                );
            }


            await connection.query(
                `UPDATE qr_orders
                 SET
                    stock_deducted = TRUE,
                    order_status = 'accepted'
                 WHERE id = ?
                 AND business_id = ?`,
                [
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({
                success: true,
                message: "Order accepted and stock updated",
                order_status: "accepted"
            });
        }


        // =====================================
        // CANCEL AFTER STOCK DEDUCTED
        //
        // Restore stock
        // =====================================

        if (
            (status === "cancelled" ||
             status === "rejected") &&
            order.stock_deducted
        ) {

            for (const item of items) {

                await connection.query(
                    `UPDATE products
                     SET stock = stock + ?
                     WHERE id = ?
                     AND business_id = ?`,
                    [
                        item.quantity,
                        item.product_id,
                        businessId
                    ]
                );
            }


            await connection.query(
                `UPDATE qr_orders
                 SET
                    stock_deducted = FALSE,
                    order_status = ?
                 WHERE id = ?
                 AND business_id = ?`,
                [
                    status,
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({
                success: true,
                message: `Order ${status} and stock restored`,
                order_status: status
            });
        }


        // =====================================
        // NORMAL STATUS UPDATE
        // =====================================

        await connection.query(
            `UPDATE qr_orders
             SET order_status = ?
             WHERE id = ?
             AND business_id = ?`,
            [
                status,
                id,
                businessId
            ]
        );


        await connection.commit();


        res.json({
            success: true,
            message: "QR order status updated",
            order_status: status
        });


    } catch (err) {

        await connection.rollback();

        console.error(
            "Update QR Order Status Error:",
            err
        );

        res.status(400).json({
            success: false,
            message: err.message
        });

    } finally {

        connection.release();
    }
};


// ============================================
// OWNER - UPDATE PAYMENT
// ============================================

exports.updateQRPayment = async (req, res) => {

    try {

        const businessId = req.businessId;
        const { id } = req.params;

        const {
            payment_method,
            payment_status
        } = req.body;


        const validPaymentStatuses = [
            "pending",
            "paid",
            "failed"
        ];


        if (!validPaymentStatuses.includes(payment_status)) {

            return res.status(400).json({
                success: false,
                message: "Invalid payment status"
            });
        }


        const [result] = await db.query(
            `UPDATE qr_orders

             SET
                payment_method = ?,
                payment_status = ?

             WHERE id = ?
             AND business_id = ?`,
            [
                payment_method || null,
                payment_status,
                id,
                businessId
            ]
        );


        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "QR order not found"
            });
        }


        res.json({
            success: true,
            message: "Payment updated successfully"
        });


    } catch (err) {

        console.error(
            "Update QR Payment Error:",
            err
        );

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};