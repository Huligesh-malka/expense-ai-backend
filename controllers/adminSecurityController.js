// controllers/adminSecurityController.js

const db = require("../config/db");

// =====================================================
// SECURITY OVERVIEW
// =====================================================

exports.getSecurityOverview = async (req, res) => {
    try {

        // ---------------------------------------------
        // TOTAL EVENTS
        // ---------------------------------------------

        const [totalRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
        `);

        // ---------------------------------------------
        // FAILED LOGINS
        // ---------------------------------------------

        const [failedRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE event_type = 'LOGIN_FAILED'
        `);

        // ---------------------------------------------
        // SUCCESSFUL LOGINS
        // ---------------------------------------------

        const [successRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE event_type = 'LOGIN_SUCCESS'
        `);

        // ---------------------------------------------
        // UNAUTHORIZED
        // ---------------------------------------------

        const [unauthorizedRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE status_code = 401
        `);

        // ---------------------------------------------
        // FORBIDDEN
        // ---------------------------------------------

        const [forbiddenRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE status_code = 403
        `);

        // ---------------------------------------------
        // HIGH EVENTS
        // ---------------------------------------------

        const [highRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE LOWER(severity) = 'high'
        `);

        // ---------------------------------------------
        // CRITICAL EVENTS
        // ---------------------------------------------

        const [criticalRows] = await db.query(`
            SELECT COUNT(*) AS total
            FROM security_events
            WHERE LOWER(severity) = 'critical'
        `);

        // ---------------------------------------------
        // FAILED LOGIN BY IP
        // ---------------------------------------------

        const [ipRows] = await db.query(`
            SELECT
                ip_address AS ip,
                COUNT(*) AS failedLogins,
                COUNT(*) AS totalEvents,
                COUNT(DISTINCT user_id) AS affectedUsers
            FROM security_events
            WHERE event_type = 'LOGIN_FAILED'
              AND ip_address IS NOT NULL
            GROUP BY ip_address
            HAVING COUNT(*) >= 3
            ORDER BY failedLogins DESC
            LIMIT 20
        `);

        // ---------------------------------------------
        // SUSPICIOUS USERS
        // ---------------------------------------------

        const [userRows] = await db.query(`
            SELECT
                user_id AS userId,
                COUNT(*) AS failedLogins
            FROM security_events
            WHERE event_type = 'LOGIN_FAILED'
              AND user_id IS NOT NULL
            GROUP BY user_id
            HAVING COUNT(*) >= 3
            ORDER BY failedLogins DESC
            LIMIT 20
        `);

        // ---------------------------------------------
        // RECENT ALERTS
        // ---------------------------------------------

        const [alertRows] = await db.query(`
            SELECT
                id,
                event_type,
                severity,
                ip_address,
                endpoint,
                status_code,
                details,
                created_at
            FROM security_events
            WHERE LOWER(severity) IN ('high', 'critical')
            ORDER BY created_at DESC
            LIMIT 20
        `);

        // ---------------------------------------------
        // RISK CALCULATION
        // ---------------------------------------------

        const failedLogins =
            Number(failedRows[0]?.total || 0);

        const unauthorizedRequests =
            Number(unauthorizedRows[0]?.total || 0);

        const forbiddenRequests =
            Number(forbiddenRows[0]?.total || 0);

        const highEvents =
            Number(highRows[0]?.total || 0);

        const criticalEvents =
            Number(criticalRows[0]?.total || 0);

        let riskScore =
            (failedLogins * 3) +
            (unauthorizedRequests * 2) +
            (forbiddenRequests * 3) +
            (highEvents * 5) +
            (criticalEvents * 10);

        // Maximum 100
        riskScore = Math.min(
            100,
            Math.max(0, riskScore)
        );

        let riskLevel = "LOW";

        if (riskScore >= 75) {
            riskLevel = "CRITICAL";
        }
        else if (riskScore >= 50) {
            riskLevel = "HIGH";
        }
        else if (riskScore >= 25) {
            riskLevel = "MEDIUM";
        }

        // ---------------------------------------------
        // ALERT FORMAT
        // ---------------------------------------------

        const alerts = alertRows.map((row) => {

            let details = {};

            try {
                details =
                    typeof row.details === "string"
                        ? JSON.parse(row.details)
                        : (row.details || {});
            }
            catch {
                details = {};
            }

            return {
                id: row.id,

                title:
                    row.event_type === "LOGIN_FAILED"
                        ? "Failed Login Activity"
                        : row.event_type === "ACCOUNT_LOCKED"
                            ? "Account Security Alert"
                            : "Security Event",

                severity:
                    row.severity || "medium",

                message:
                    details.reason ||
                    `${row.event_type || "Security event"} detected.`,

                recommendation:
                    row.event_type === "LOGIN_FAILED"
                        ? "Review repeated failed login attempts."
                        : row.event_type === "ACCOUNT_LOCKED"
                            ? "Review the affected account and login activity."
                            : "Review this security event."
            };
        });

        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        return res.status(200).json({

            success: true,

            data: {

                risk: {
                    score: riskScore,
                    level: riskLevel,

                    summary:
                        riskLevel === "LOW"
                            ? "No significant security threats detected."
                            : riskLevel === "MEDIUM"
                                ? "Some suspicious security activity requires monitoring."
                                : riskLevel === "HIGH"
                                    ? "High-risk security activity detected. Review recent events."
                                    : "Critical security activity detected. Immediate review is recommended."
                },

                statistics: {

                    totalEvents:
                        Number(totalRows[0]?.total || 0),

                    failedLogins,

                    successfulLogins:
                        Number(successRows[0]?.total || 0),

                    unauthorizedRequests,

                    forbiddenRequests,

                    highEvents,

                    criticalEvents
                },

                alerts,

                suspiciousIPs:
                    ipRows.map((row) => ({
                        ip: row.ip,
                        failedLogins:
                            Number(row.failedLogins || 0),
                        totalEvents:
                            Number(row.totalEvents || 0),
                        affectedUsers:
                            Number(row.affectedUsers || 0)
                    })),

                suspiciousUsers:
                    userRows.map((row) => ({
                        userId: row.userId,
                        failedLogins:
                            Number(row.failedLogins || 0)
                    }))
            }

        });

    }
    catch (err) {

        console.error(
            "Security Overview Error:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to load security overview"

        });

    }
};


// =====================================================
// SECURITY EVENTS
// =====================================================

exports.getSecurityEvents = async (req, res) => {

    try {

        let limit =
            parseInt(req.query.limit, 10) || 100;

        // Prevent huge queries
        limit = Math.min(
            Math.max(limit, 1),
            500
        );

        const [rows] = await db.query(
            `
            SELECT
                id,
                user_id,
                event_type,
                severity,
                ip_address,
                user_agent,
                endpoint,
                http_method,
                status_code,
                details,
                created_at
            FROM security_events
            ORDER BY created_at DESC
            LIMIT ?
            `,
            [limit]
        );

        return res.status(200).json({

            success: true,

            total: rows.length,

            data: rows

        });

    }
    catch (err) {

        console.error(
            "Security Events Error:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to load security events"

        });

    }

};


// =====================================================
// SECURITY AI
// =====================================================

exports.getSecurityAI = async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT
                event_type,
                severity,
                status_code
            FROM security_events
            ORDER BY created_at DESC
            LIMIT 500
        `);

        let failedLogins = 0;
        let successfulLogins = 0;
        let unauthorizedRequests = 0;
        let forbiddenRequests = 0;
        let highEvents = 0;
        let criticalEvents = 0;

        for (const event of rows) {

            if (
                event.event_type ===
                "LOGIN_FAILED"
            ) {
                failedLogins++;
            }

            if (
                event.event_type ===
                "LOGIN_SUCCESS"
            ) {
                successfulLogins++;
            }

            if (
                Number(event.status_code) === 401
            ) {
                unauthorizedRequests++;
            }

            if (
                Number(event.status_code) === 403
            ) {
                forbiddenRequests++;
            }

            if (
                String(event.severity).toLowerCase() ===
                "high"
            ) {
                highEvents++;
            }

            if (
                String(event.severity).toLowerCase() ===
                "critical"
            ) {
                criticalEvents++;
            }
        }

        let score =
            (failedLogins * 3) +
            (unauthorizedRequests * 2) +
            (forbiddenRequests * 3) +
            (highEvents * 5) +
            (criticalEvents * 10);

        score = Math.min(
            100,
            score
        );

        let level = "LOW";

        if (score >= 75) {
            level = "CRITICAL";
        }
        else if (score >= 50) {
            level = "HIGH";
        }
        else if (score >= 25) {
            level = "MEDIUM";
        }

        return res.status(200).json({

            success: true,

            data: {

                risk: {

                    score,

                    level,

                    summary:
                        `${failedLogins} failed login attempts detected. ` +
                        `${unauthorizedRequests} unauthorized requests and ` +
                        `${criticalEvents} critical events detected.`

                },

                statistics: {

                    totalEvents: rows.length,

                    failedLogins,

                    successfulLogins,

                    unauthorizedRequests,

                    forbiddenRequests,

                    highEvents,

                    criticalEvents

                }

            }

        });

    }
    catch (err) {

        console.error(
            "Security AI Error:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to run security AI analysis"

        });

    }

};