// middleware/adminMiddleware.js

module.exports = (req, res, next) => {
    try {

        // authMiddleware must run before adminMiddleware
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // Admin role check
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }

        next();

    } catch (err) {

        console.error("Admin Middleware Error:", err);

        return res.status(500).json({
            success: false,
            message: "Admin authorization failed"
        });
    }
};