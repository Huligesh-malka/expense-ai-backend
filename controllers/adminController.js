// controllers/adminController.js

const db = require("../config/db");


// =====================================
// ADMIN DASHBOARD
// =====================================

exports.getDashboard = async (req, res) => {

    try {

        // =====================================
        // TOTAL USERS
        // =====================================

        const [userRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM users
        `);


        // =====================================
        // TOTAL BUSINESSES
        // =====================================

        const [businessRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM businesses
        `);


        const totalUsers =
            Number(userRows[0]?.total || 0);

        const totalBusinesses =
            Number(businessRows[0]?.total || 0);


        // =====================================
        // IMPORTANT
        //
        // Your current businesses table does not
        // have a status column.
        //
        // Therefore, don't query:
        //
        // WHERE status = 'active'
        //
        // until you add that column.
        // =====================================

        const activeBusinesses = totalBusinesses;

        const inactiveBusinesses = 0;


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            data: {

                users: {
                    total: totalUsers
                },

                businesses: {
                    total: totalBusinesses,
                    active: activeBusinesses,
                    inactive: inactiveBusinesses
                }

            }

        });

    }

    catch (err) {

        console.error(
            "Admin Dashboard Error:",
            err
        );

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

                b.owner_id,

                b.business_name,

                b.business_type,

                b.phone,

                b.email,

                b.gst_number,

                b.upi_id,

                b.address,

                b.city,

                b.state,

                b.pincode,

                b.logo,

                b.created_at,

                b.owner_name,

                u.full_name AS user_name,

                u.email AS user_email

            FROM businesses b

            LEFT JOIN users u
                ON u.id = b.owner_id

            ORDER BY b.id DESC

        `);


        // =====================================
        // ADD FRONTEND-FRIENDLY STATUS
        // =====================================

        const businesses = rows.map((business) => {

            return {

                ...business,

                status: "active"

            };

        });


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            total: businesses.length,

            data: businesses

        });

    }

    catch (err) {

        console.error(
            "Admin Get Businesses Error:",
            err
        );

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

                phone,

                role,

                auth_provider,

                created_at,

                updated_at

            FROM users

            ORDER BY id DESC

        `);


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            total: rows.length,

            data: rows

        });

    }

    catch (err) {

        console.error(
            "Admin Get Users Error:",
            err
        );

        return res.status(500).json({

            success: false,

            message: "Failed to load users"

        });

    }

};