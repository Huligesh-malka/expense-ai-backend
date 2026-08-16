const db = require("../config/db");

module.exports = async (req, res, next) => {
    try {
        const businessId = Number(
            req.params.businessId ||
            req.query.business_id ||
            req.body.business_id
        );

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const [business] = await db.query(
            `SELECT id
             FROM businesses
             WHERE id=? AND owner_id=?
             LIMIT 1`,
            [businessId, req.user.id]
        );

        if (business.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this business"
            });
        }

        req.businessId = businessId;

        next();

    } catch (err) {
        console.error("Business Authorization Error:", err);

        return res.status(500).json({
            success: false,
            message: "Authorization check failed"
        });
    }
};