// middleware/adminMiddleware.js

const db = require("../config/db");

module.exports = async (req, res, next) => {
    try {

        // =====================================
        // AUTHENTICATION CHECK
        // =====================================

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }


        // =====================================
        // GET CURRENT USER FROM DATABASE
        // =====================================

        const [users] = await db.query(
            `
            SELECT
                id,
                role
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [req.user.id]
        );


        // =====================================
        // USER NOT FOUND
        // =====================================

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User account not found"
            });
        }


        const user = users[0];


        // =====================================
        // ADMIN CHECK
        // =====================================

        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }


        // =====================================
        // ATTACH VERIFIED ADMIN USER
        // =====================================

        req.admin = {
            id: user.id,
            role: user.role
        };


        next();

    } catch (err) {

        console.error(
            "Admin Middleware Error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Admin authorization failed"
        });
    }
};