const db = require("../config/db");

const {
    logSecurityEvent
} = require("./securityLogger");


// =====================================
// BUSINESS AUTHORIZATION
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
                eventType: "BUSINESS_AUTH_REQUIRED",
                severity: "medium",
                statusCode: 401
            });

            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }


        // =====================================
        // FIND USER'S BUSINESS
        // =====================================

        const [businesses] = await db.query(
            `
            SELECT
                id
            FROM businesses
            WHERE owner_id = ?
            LIMIT 1
            `,
            [req.user.id]
        );


        // =====================================
        // BUSINESS NOT FOUND
        // =====================================

        if (businesses.length === 0) {

            await logSecurityEvent({
                req,
                userId: req.user.id,
                eventType: "BUSINESS_NOT_FOUND",
                severity: "low",
                statusCode: 403
            });

            return res.status(403).json({
                success: false,
                message: "Business not found"
            });
        }


        // =====================================
        // VERIFIED BUSINESS ID
        // =====================================

        req.businessId =
            businesses[0].id;


        next();

    } catch (err) {

        console.error(
            "Business Authorization Error:",
            err
        );


        await logSecurityEvent({
            req,
            userId: req.user?.id || null,
            eventType: "BUSINESS_AUTH_ERROR",
            severity: "high",
            statusCode: 500,
            details: {
                error: err.message
            }
        });


        return res.status(500).json({
            success: false,
            message: "Authorization check failed"
        });
    }
};