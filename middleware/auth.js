const jwt = require("jsonwebtoken");
const {
    logSecurityEvent
} = require("./securityLogger");


// =====================================
// AUTHENTICATION MIDDLEWARE
// =====================================

module.exports = async (req, res, next) => {

    try {

        // =====================================
        // AUTHORIZATION HEADER
        // =====================================

        const authHeader =
            req.header("Authorization");


        if (!authHeader) {

            await logSecurityEvent({
                req,
                eventType: "MISSING_AUTH_TOKEN",
                severity: "low",
                statusCode: 401,
                details: {
                    reason: "Authorization header missing"
                }
            });

            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }


        // =====================================
        // BEARER FORMAT
        // =====================================

        if (!authHeader.startsWith("Bearer ")) {

            await logSecurityEvent({
                req,
                eventType: "INVALID_AUTH_FORMAT",
                severity: "medium",
                statusCode: 401,
                details: {
                    reason: "Invalid Bearer authorization format"
                }
            });

            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });
        }


        // =====================================
        // EXTRACT TOKEN
        // =====================================

        const token =
            authHeader.substring(7).trim();


        if (!token) {

            await logSecurityEvent({
                req,
                eventType: "EMPTY_AUTH_TOKEN",
                severity: "medium",
                statusCode: 401,
                details: {
                    reason: "Empty authentication token"
                }
            });

            return res.status(401).json({
                success: false,
                message: "Authentication token missing"
            });
        }


        // =====================================
        // VERIFY JWT
        // =====================================

        const verified = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        // =====================================
        // VALIDATE PAYLOAD
        // =====================================

        if (
            !verified ||
            !verified.id
        ) {

            await logSecurityEvent({
                req,
                eventType: "INVALID_AUTH_PAYLOAD",
                severity: "high",
                statusCode: 401,
                details: {
                    reason: "JWT user ID missing"
                }
            });

            return res.status(401).json({
                success: false,
                message: "Invalid authentication token"
            });
        }


        // =====================================
        // ONLY TRUST USER ID
        // =====================================

        req.user = {
            id: verified.id
        };


        // =====================================
        // CONTINUE
        // =====================================

        next();

    } catch (err) {

        console.error(
            "Authentication Error:",
            err.message
        );


        // =====================================
        // INVALID / EXPIRED TOKEN
        // =====================================

        await logSecurityEvent({
            req,
            eventType: "INVALID_AUTH_TOKEN",
            severity: "medium",
            statusCode: 401,
            details: {
                reason: err.name || "JWT verification failed"
            }
        });


        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};