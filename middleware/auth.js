// middleware/authMiddleware.js

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });
        }

        const token = authHeader.substring(7);

        const verified = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = verified;

        next();

    } catch (err) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};