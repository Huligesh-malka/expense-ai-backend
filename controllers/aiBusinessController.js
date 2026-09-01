const {
    getBusinessAnalytics
} = require("../services/businessAnalytics");

// ============================================================
// AI BUSINESS ANALYTICS CONTROLLER
// ============================================================
// GET /api/ai-business/analytics
//
// Business ID ALWAYS comes from businessMiddleware:
// req.businessId
//
// Never accept business_id from frontend.
// ============================================================

exports.getBusinessAnalytics = async (req, res) => {
    try {

        const businessId = req.businessId;

        // --------------------------------------------
        // SECURITY
        // --------------------------------------------

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business information not found"
            });
        }

        // --------------------------------------------
        // GET REAL BUSINESS DATABASE DATA
        // --------------------------------------------

        const analytics = await getBusinessAnalytics(
            Number(businessId)
        );

        // --------------------------------------------
        // RESPONSE
        // --------------------------------------------

        return res.status(200).json({
            success: true,
            message: "AI business data generated successfully",
            data: analytics
        });

    } catch (error) {

        console.error(
            "AI Business Analytics Controller Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to generate AI business data",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined
        });
    }
};