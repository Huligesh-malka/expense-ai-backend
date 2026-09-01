const {
    getBusinessAnalytics
} = require("../services/businessAnalytics");


// ============================================================
// GET AI BUSINESS ANALYTICS
// ============================================================
// GET /api/ai-business/analytics
//
// Business ID comes from authentication middleware:
// req.businessId
//
// NEVER take business_id from req.query or req.body.
// ============================================================

exports.getBusinessAnalytics = async (req, res) => {

    try {

        const businessId = req.businessId;


        // ====================================================
        // SECURITY CHECK
        // ====================================================

        if (!businessId) {

            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });

        }


        // ====================================================
        // GET BUSINESS ANALYTICS
        // ====================================================

        const analytics =
            await getBusinessAnalytics(businessId);


        // ====================================================
        // SEND RESPONSE
        // ====================================================

        return res.status(200).json({

            success: true,

            message:
                "Business analytics generated successfully",

            data: analytics

        });

    } catch (error) {

        console.error(
            "AI Business Analytics Controller Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to generate business analytics",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};