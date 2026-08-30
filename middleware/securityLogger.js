const db = require("../config/db");


// =====================================
// SECURITY EVENT LOGGER
// =====================================

const logSecurityEvent = async ({
    userId = null,
    eventType,
    severity = "low",
    req = null,
    statusCode = null,
    details = {}
}) => {

    try {

        // =====================================
        // IP ADDRESS
        // =====================================

        const forwardedFor =
            req?.headers?.["x-forwarded-for"];

        const ipAddress =
            forwardedFor
                ? forwardedFor.split(",")[0].trim()
                : req?.socket?.remoteAddress || null;


        // =====================================
        // USER AGENT
        // =====================================

        const userAgent =
            req?.headers?.["user-agent"] || null;


        // =====================================
        // ENDPOINT
        // =====================================

        const endpoint =
            req?.originalUrl ||
            req?.url ||
            null;


        // =====================================
        // HTTP METHOD
        // =====================================

        const method =
            req?.method || null;


        // =====================================
        // DATABASE
        // =====================================

        await db.query(
            `
            INSERT INTO security_events (
                user_id,
                event_type,
                severity,
                ip_address,
                user_agent,
                endpoint,
                http_method,
                status_code,
                details
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                userId,
                eventType,
                severity,
                ipAddress,
                userAgent,
                endpoint,
                method,
                statusCode,
                JSON.stringify(details)
            ]
        );

    } catch (err) {

        // =====================================
        // IMPORTANT
        //
        // Security logging must NEVER crash
        // the actual application request.
        // =====================================

        console.error(
            "Security Logger Error:",
            err.message
        );
    }
};


module.exports = {
    logSecurityEvent
};