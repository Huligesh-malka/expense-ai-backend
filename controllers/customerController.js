const db = require("../config/db");

// =====================================
// CREATE CUSTOMER
// =====================================

exports.createCustomer = async (req, res) => {
    try {
        const {
            customer_name,
            customer_phone,
            customer_email,
            address
        } = req.body;

        // Get business_id from middleware instead of request body
        const businessId = req.businessId;

        // Validation
        if (!customer_name) {
            return res.status(400).json({
                success: false,
                message: "Customer name is required"
            });
        }

        if (!customer_phone) {
            return res.status(400).json({
                success: false,
                message: "Customer phone is required"
            });
        }

        // Check existing customer
        const [existing] = await db.query(
            `SELECT id
             FROM customers
             WHERE business_id = ?
             AND customer_phone = ?`,
            [businessId, customer_phone]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Customer already exists"
            });
        }

        // Insert customer
        const [result] = await db.query(
            `INSERT INTO customers
            (
                business_id,
                customer_name,
                customer_phone,
                customer_email,
                address
            )
            VALUES
            (?, ?, ?, ?, ?)`,
            [
                businessId,
                customer_name,
                customer_phone,
                customer_email || null,
                address || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            customerId: result.insertId
        });

    } catch (err) {
        console.error("Create Customer Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to create customer"
        });
    }
};

// =====================================
// GET ALL CUSTOMERS
// =====================================

exports.getCustomers = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [customers] = await db.query(
            `SELECT
                id,
                customer_name,
                customer_phone,
                customer_email,
                address,
                total_orders,
                total_spent,
                last_purchase,
                status,
                created_at
            FROM customers
            WHERE business_id = ?
            ORDER BY id DESC`,
            [businessId]
        );

        res.json({
            success: true,
            total: customers.length,
            data: customers
        });

    } catch (err) {
        console.error("Get Customers Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch customers"
        });
    }
};

// =====================================
// GET SINGLE CUSTOMER
// =====================================

exports.getCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        const [customer] = await db.query(
            `SELECT
                id,
                business_id,
                customer_name,
                customer_phone,
                customer_email,
                address,
                total_orders,
                total_spent,
                last_purchase,
                status,
                created_at,
                updated_at
             FROM customers
             WHERE id = ?
             AND business_id = ?`,
            [id, businessId]
        );

        if (customer.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            data: customer[0]
        });

    } catch (err) {
        console.error("Get Customer Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch customer"
        });
    }
};

// =====================================
// UPDATE CUSTOMER
// =====================================

exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        const {
            customer_name,
            customer_phone,
            customer_email,
            address,
            status
        } = req.body;

        // Check customer exists AND belongs to this business
        const [customer] = await db.query(
            `SELECT * FROM customers 
             WHERE id = ? 
             AND business_id = ?`,
            [id, businessId]
        );

        if (customer.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        // Check duplicate phone number (only if phone is being updated)
        if (customer_phone) {
            const [exists] = await db.query(
                `SELECT id
                 FROM customers
                 WHERE customer_phone = ?
                 AND id <> ?
                 AND business_id = ?`,
                [
                    customer_phone,
                    id,
                    businessId
                ]
            );

            if (exists.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number already exists"
                });
            }
        }

        await db.query(
            `UPDATE customers
             SET
                customer_name = ?,
                customer_phone = ?,
                customer_email = ?,
                address = ?,
                status = ?
             WHERE id = ?
             AND business_id = ?`,
            [
                customer_name || customer[0].customer_name,
                customer_phone || customer[0].customer_phone,
                customer_email || customer[0].customer_email,
                address || customer[0].address,
                status || customer[0].status,
                id,
                businessId
            ]
        );

        res.json({
            success: true,
            message: "Customer updated successfully"
        });

    } catch (err) {
        console.error("Update Customer Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to update customer"
        });
    }
};

// =====================================
// GET CUSTOMER PURCHASE HISTORY
// =====================================

exports.getCustomerHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        // Customer Details - ensure customer belongs to this business
        const [customer] = await db.query(
            `SELECT
                id,
                business_id,
                customer_name,
                customer_phone,
                customer_email,
                address,
                total_orders,
                total_spent,
                last_purchase,
                status,
                created_at
            FROM customers
            WHERE id = ?
            AND business_id = ?`,
            [id, businessId]
        );

        if (customer.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        // Customer Sales History
        const [sales] = await db.query(
            `SELECT
                id,
                invoice_no,
                subtotal,
                discount,
                tax,
                total_amount,
                payment_method,
                payment_status,
                created_at
            FROM sales
            WHERE customer_id = ?
            ORDER BY created_at DESC`,
            [id]
        );

        res.json({
            success: true,
            customer: customer[0],
            sales
        });

    } catch (err) {
        console.error("Get Customer History Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch customer history"
        });
    }
};