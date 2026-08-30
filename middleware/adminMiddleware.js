const db = require("../config/db");

const {
    logSecurityEvent
} = require("./securityLogger");


// =====================================
// ADMIN AUTHORIZATION
// =====================================

module.exports = async (req, res, next) => {

    try {

        // =====================================
        // AUTHENTICATION CHECK
        // =====================================

        if (
            !req.user ||
            !req.user.id
        ) {

            await logSecurityEvent({
                req,
                eventType: "ADMIN_AUTH_REQUIRED",
                severity: "medium",
                statusCode: 401
            });

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

            await logSecurityEvent({
                req,
                userId: req.user.id,
                eventType: "ADMIN_USER_NOT_FOUND",
                severity: "high",
                statusCode: 401
            });

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

            await logSecurityEvent({
                req,
                userId: user.id,
                eventType: "UNAUTHORIZED_ADMIN_ACCESS",
                severity: "high",
                statusCode: 403,
                details: {
                    attemptedEndpoint: req.originalUrl,
                    userRole: user.role
                }
            });

            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }


        // =====================================
        // VERIFIED ADMIN
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


        await logSecurityEvent({
            req,
            userId: req.user?.id || null,
            eventType: "ADMIN_AUTH_ERROR",
            severity: "high",
            statusCode: 500,
            details: {
                error: err.message
            }
        });


        return res.status(500).json({
            success: false,
            message: "Admin authorization failed"
        });
    }
};