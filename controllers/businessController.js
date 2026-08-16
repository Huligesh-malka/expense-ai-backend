const db = require("../config/db");

// ===============================
// Create Business
// ===============================
exports.createBusiness = async (req, res) => {
    try {
        // IMPORTANT: Use req.user.id instead of trusting client input
        const ownerId = req.user.id;
        
        const {
            business_name,
            business_type,
            owner_name,
            phone,
            email,
            gst_number,
            upi_id,
            address,
            city,
            state,
            pincode,
            logo
        } = req.body;

        // Validate required fields
        if (!business_name || !business_type) {
            return res.status(400).json({
                success: false,
                message: "Business Name and Business Type are required."
            });
        }

        // Check if business already exists for this owner
        const [existing] = await db.query(
            "SELECT id FROM businesses WHERE owner_id = ?",
            [ownerId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "You already have a business registered."
            });
        }

        // Insert new business
        const [result] = await db.query(
            `INSERT INTO businesses (
                owner_id,
                business_name,
                business_type,
                owner_name,
                phone,
                email,
                gst_number,
                upi_id,
                address,
                city,
                state,
                pincode,
                logo,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [
                ownerId,
                business_name,
                business_type,
                owner_name || null,
                phone || null,
                email || null,
                gst_number || null,
                upi_id || null,
                address || null,
                city || null,
                state || null,
                pincode || null,
                logo || null
            ]
        );

        // Fetch the created business
        const [newBusiness] = await db.query(
            "SELECT * FROM businesses WHERE id = ?",
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Business Created Successfully",
            business: newBusiness[0]
        });

    } catch (err) {
        console.error("Create Business Error:", err);
        
        // Handle unique constraint violation
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: "You already have a business registered."
            });
        }

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Get My Business (Protected)
// ===============================
exports.getMyBusiness = async (req, res) => {
    try {
        // req.businessId is set by businessMiddleware
        const businessId = req.businessId;

        const [business] = await db.query(
            `SELECT 
                id,
                business_name,
                business_type,
                owner_name,
                phone,
                email,
                gst_number,
                upi_id,
                address,
                city,
                state,
                pincode,
                logo,
                status,
                created_at,
                updated_at
            FROM businesses 
            WHERE id = ?`,
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        res.json({
            success: true,
            data: business[0]
        });

    } catch (err) {
        console.error("Get Business Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Update My Business (Protected)
// ===============================
exports.updateMyBusiness = async (req, res) => {
    try {
        const businessId = req.businessId;
        
        const {
            business_name,
            business_type,
            owner_name,
            phone,
            email,
            gst_number,
            upi_id,
            address,
            city,
            state,
            pincode,
            logo
        } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (business_name !== undefined) {
            updates.push("business_name = ?");
            values.push(business_name);
        }
        if (business_type !== undefined) {
            updates.push("business_type = ?");
            values.push(business_type);
        }
        if (owner_name !== undefined) {
            updates.push("owner_name = ?");
            values.push(owner_name);
        }
        if (phone !== undefined) {
            updates.push("phone = ?");
            values.push(phone);
        }
        if (email !== undefined) {
            updates.push("email = ?");
            values.push(email);
        }
        if (gst_number !== undefined) {
            updates.push("gst_number = ?");
            values.push(gst_number);
        }
        if (upi_id !== undefined) {
            updates.push("upi_id = ?");
            values.push(upi_id);
        }
        if (address !== undefined) {
            updates.push("address = ?");
            values.push(address);
        }
        if (city !== undefined) {
            updates.push("city = ?");
            values.push(city);
        }
        if (state !== undefined) {
            updates.push("state = ?");
            values.push(state);
        }
        if (pincode !== undefined) {
            updates.push("pincode = ?");
            values.push(pincode);
        }
        if (logo !== undefined) {
            updates.push("logo = ?");
            values.push(logo);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No fields to update"
            });
        }

        // Add updated_at timestamp
        updates.push("updated_at = CURRENT_TIMESTAMP");
        values.push(businessId);

        const query = `UPDATE businesses SET ${updates.join(", ")} WHERE id = ?`;
        
        await db.query(query, values);

        // Fetch updated business
        const [updatedBusiness] = await db.query(
            "SELECT * FROM businesses WHERE id = ?",
            [businessId]
        );

        res.json({
            success: true,
            message: "Business Updated Successfully",
            business: updatedBusiness[0]
        });

    } catch (err) {
        console.error("Update Business Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Get My Business Profile (Protected)
// ===============================
exports.getMyBusinessProfile = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            `SELECT 
                b.*,
                u.name as owner_name,
                u.email as owner_email
            FROM businesses b
            INNER JOIN users u ON u.id = b.owner_id
            WHERE b.id = ?`,
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Business profile not found"
            });
        }

        res.json({
            success: true,
            business: business[0]
        });

    } catch (err) {
        console.error("Get Business Profile Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Update My Business Profile (Protected)
// ===============================
exports.updateMyBusinessProfile = async (req, res) => {
    try {
        const businessId = req.businessId;
        
        const {
            business_name,
            business_type,
            owner_name,
            phone,
            email,
            gst_number,
            upi_id,
            address,
            city,
            state,
            pincode,
            logo
        } = req.body;

        // Validate required fields
        if (!business_name || !business_type) {
            return res.status(400).json({
                success: false,
                message: "Business Name and Business Type are required"
            });
        }

        await db.query(
            `UPDATE businesses SET
                business_name = ?,
                business_type = ?,
                owner_name = ?,
                phone = ?,
                email = ?,
                gst_number = ?,
                upi_id = ?,
                address = ?,
                city = ?,
                state = ?,
                pincode = ?,
                logo = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
                business_name,
                business_type,
                owner_name || null,
                phone || null,
                email || null,
                gst_number || null,
                upi_id || null,
                address || null,
                city || null,
                state || null,
                pincode || null,
                logo || null,
                businessId
            ]
        );

        const [updatedBusiness] = await db.query(
            "SELECT * FROM businesses WHERE id = ?",
            [businessId]
        );

        res.json({
            success: true,
            message: "Business Profile Updated Successfully",
            business: updatedBusiness[0]
        });

    } catch (err) {
        console.error("Update Business Profile Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Deactivate Business (Soft Delete)
// ===============================
exports.deactivateBusiness = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            "SELECT status FROM businesses WHERE id = ?",
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        if (business[0].status === 'inactive') {
            return res.status(400).json({
                success: false,
                message: "Business is already deactivated"
            });
        }

        await db.query(
            "UPDATE businesses SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [businessId]
        );

        res.json({
            success: true,
            message: "Business deactivated successfully"
        });

    } catch (err) {
        console.error("Deactivate Business Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Reactivate Business
// ===============================
exports.reactivateBusiness = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            "SELECT status FROM businesses WHERE id = ?",
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        if (business[0].status === 'active') {
            return res.status(400).json({
                success: false,
                message: "Business is already active"
            });
        }

        await db.query(
            "UPDATE businesses SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [businessId]
        );

        res.json({
            success: true,
            message: "Business reactivated successfully"
        });

    } catch (err) {
        console.error("Reactivate Business Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// ADMIN ONLY: Get All Businesses
// ===============================
exports.getAllBusinesses = async (req, res) => {
    try {
        // TODO: Add admin role check middleware
        // if (!req.user.isAdmin) {
        //     return res.status(403).json({
        //         success: false,
        //         message: "Admin access required"
        //     });
        // }

        const [rows] = await db.query(
            `SELECT 
                b.id,
                b.business_name,
                b.business_type,
                b.owner_name,
                b.phone,
                b.email,
                b.city,
                b.state,
                b.status,
                b.created_at,
                u.name as owner_name,
                u.email as owner_email
            FROM businesses b
            INNER JOIN users u ON u.id = b.owner_id
            ORDER BY b.id DESC`
        );

        res.json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("Get All Businesses Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};