const db = require("../config/db");

// =====================================
// CREATE CUSTOMER
// =====================================

exports.createCustomer = async (req, res) => {
    try {
        const {
            business_id,
            customer_name,
            customer_phone,
            customer_email,
            address
        } = req.body;

        // Validation
        if (!business_id) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

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
            [business_id, customer_phone]
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
                business_id,
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
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};



// =====================================
// GET ALL CUSTOMERS
// =====================================

exports.getCustomers = async (req, res) => {
    try {
        const business_id = req.query.business_id;

        if (!business_id) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

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
            [business_id]
        );

        res.json({
            success: true,
            total: customers.length,
            data: customers
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};





// =====================================
// GET SINGLE CUSTOMER
// =====================================

exports.getCustomer = async (req, res) => {
    try {
        const { id } = req.params;

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
             WHERE id = ?`,
            [id]
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
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// =====================================
// UPDATE CUSTOMER
// =====================================

exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            customer_name,
            customer_phone,
            customer_email,
            address,
            status
        } = req.body;

        // Check customer exists
        const [customer] = await db.query(
            "SELECT * FROM customers WHERE id=?",
            [id]
        );

        if (customer.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        // Check duplicate phone number
        if (customer_phone) {
            const [exists] = await db.query(
                `SELECT id
                 FROM customers
                 WHERE customer_phone=?
                 AND id<>?
                 AND business_id=?`,
                [
                    customer_phone,
                    id,
                    customer[0].business_id
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
                customer_name=?,
                customer_phone=?,
                customer_email=?,
                address=?,
                status=?
             WHERE id=?`,
            [
                customer_name || customer[0].customer_name,
                customer_phone || customer[0].customer_phone,
                customer_email || customer[0].customer_email,
                address || customer[0].address,
                status || customer[0].status,
                id
            ]
        );

        res.json({
            success: true,
            message: "Customer updated successfully"
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};






// =====================================
// GET CUSTOMER PURCHASE HISTORY
// =====================================

exports.getCustomerHistory = async (req, res) => {
    try {

        const { id } = req.params;

        // Customer Details
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
            WHERE id=?`,
            [id]
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
            WHERE customer_id=?
            ORDER BY created_at DESC`,
            [id]
        );

        res.json({
            success: true,
            customer: customer[0],
            sales
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};