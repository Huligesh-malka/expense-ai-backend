const db = require("../config/db");

// =====================================
// ADMIN DASHBOARD
// =====================================

exports.getDashboard = async (req, res) => {

    try {

        // ==============================
        // TOTAL USERS
        // ==============================

        const [users] = await db.query(`
            SELECT COUNT(*) AS total
            FROM users
        `);


        // ==============================
        // TOTAL BUSINESSES
        // ==============================

        const [businesses] = await db.query(`
            SELECT COUNT(*) AS total
            FROM businesses
        `);


        // ==============================
        // ACTIVE BUSINESSES
        // ==============================

        const [activeBusinesses] = await db.query(`
            SELECT COUNT(*) AS total
            FROM businesses
            WHERE status = 'active'
        `);


        // ==============================
        // INACTIVE BUSINESSES
        // ==============================

        const [inactiveBusinesses] = await db.query(`
            SELECT COUNT(*) AS total
            FROM businesses
            WHERE status = 'inactive'
        `);


        // ==============================
        // RESPONSE
        // ==============================

        return res.status(200).json({

            success: true,

            data: {

                users: {
                    total: Number(users[0].total)
                },

                businesses: {
                    total: Number(businesses[0].total),
                    active: Number(activeBusinesses[0].total),
                    inactive: Number(inactiveBusinesses[0].total)
                }

            }

        });

    } catch (err) {

        console.error("Admin Dashboard Error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to load admin dashboard"
        });
    }
};


// =====================================
// ALL BUSINESSES
// =====================================

exports.getAllBusinesses = async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT
                b.id,
                b.business_name,
                b.business_type,
                b.owner_name,
                b.phone,
                b.email,
                b.city,
                b.state,
                b.status,
                b.created_at,
                b.updated_at,
                u.full_name AS user_name,
                u.email AS user_email

            FROM businesses b

            LEFT JOIN users u
                ON u.id = b.owner_id

            ORDER BY b.id DESC
        `);


        return res.status(200).json({

            success: true,

            total: rows.length,

            data: rows

        });

    } catch (err) {

        console.error("Admin Get Businesses Error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to load businesses"
        });
    }
};


// =====================================
// ALL USERS
// =====================================

exports.getAllUsers = async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT
                id,
                full_name,
                email,
                role,
                created_at

            FROM users

            ORDER BY id DESC
        `);


        return res.status(200).json({

            success: true,

            total: rows.length,

            data: rows

        });

    } catch (err) {

        console.error("Admin Get Users Error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to load users"
        });
    }
};