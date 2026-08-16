const db = require("../config/db");

module.exports = async (req, res, next) => {
    try {

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const [businesses] = await db.query(
            `SELECT id
             FROM businesses
             WHERE owner_id=?
             LIMIT 1`,
            [req.user.id]
        );

        if (businesses.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Business not found"
            });
        }

        req.businessId = businesses[0].id;

        next();

    } catch (err) {

        console.error("Business Authorization Error:", err);

        return res.status(500).json({
            success: false,
            message: "Authorization check failed"
        });
    }
};