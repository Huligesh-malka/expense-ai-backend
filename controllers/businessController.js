
const db = require("../config/db");


// CREATE BUSINESS
// ======================================================
exports.createBusiness = async (req, res) => {
    try {
        // IMPORTANT:
        // Always use the authenticated user's ID.
        // Do not trust owner_id coming from the frontend.
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

        // --------------------------------------------------
        // Validate required fields
        // --------------------------------------------------
        if (!business_name || !business_type) {
            return res.status(400).json({
                success: false,
                message: "Business Name and Business Type are required."
            });
        }

        // --------------------------------------------------
        // Check if owner already has a business
        // --------------------------------------------------
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

        // --------------------------------------------------
        // Create business
        //
        // IMPORTANT:
        // Your businesses table does NOT have:
        // - status
        // - updated_at
        //
        // Therefore they must NOT be included here.
        // --------------------------------------------------
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
                logo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

        // --------------------------------------------------
        // Fetch created business
        // --------------------------------------------------
        const [newBusiness] = await db.query(
            "SELECT * FROM businesses WHERE id = ?",
            [result.insertId]
        );

        return res.status(201).json({
            success: true,
            message: "Business Created Successfully",
            business: newBusiness[0]
        });

    } catch (err) {
        console.error("Create Business Error:", err);

        // Duplicate owner_id
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "You already have a business registered."
            });
        }

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// GET MY BUSINESS
// ======================================================
exports.getMyBusiness = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            `SELECT
                id,
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
                created_at,
                trial_start_date,
                expiry_date,
                plan,
                is_trial
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

        return res.json({
            success: true,
            data: business[0]
        });

    } catch (err) {
        console.error("Get Business Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// UPDATE MY BUSINESS
// ======================================================
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

        const updates = [];
        const values = [];

        // --------------------------------------------------
        // Dynamic update fields
        // --------------------------------------------------

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

        // --------------------------------------------------
        // Nothing to update
        // --------------------------------------------------
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No fields to update"
            });
        }

        values.push(businessId);

        const query = `
            UPDATE businesses
            SET ${updates.join(", ")}
            WHERE id = ?
        `;

        await db.query(query, values);

        // --------------------------------------------------
        // Fetch updated business
        // --------------------------------------------------
        const [updatedBusiness] = await db.query(
            "SELECT * FROM businesses WHERE id = ?",
            [businessId]
        );

        return res.json({
            success: true,
            message: "Business Updated Successfully",
            business: updatedBusiness[0]
        });

    } catch (err) {
        console.error("Update Business Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// GET MY BUSINESS PROFILE
// ======================================================
exports.getMyBusinessProfile = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            `SELECT
                b.*,
                u.full_name AS user_owner_name,
                u.email AS owner_email
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

        return res.json({
            success: true,
            business: business[0]
        });

    } catch (err) {
        console.error("Get Business Profile Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// UPDATE MY BUSINESS PROFILE
// ======================================================
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

        // --------------------------------------------------
        // Validate required fields
        // --------------------------------------------------
        if (!business_name || !business_type) {
            return res.status(400).json({
                success: false,
                message: "Business Name and Business Type are required"
            });
        }

        // --------------------------------------------------
        // Update business
        // --------------------------------------------------
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
                logo = ?
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

        // --------------------------------------------------
        // Fetch updated business
        // --------------------------------------------------
        const [updatedBusiness] = await db.query(
            "SELECT * FROM businesses WHERE id = ?",
            [businessId]
        );

        return res.json({
            success: true,
            message: "Business Profile Updated Successfully",
            business: updatedBusiness[0]
        });

    } catch (err) {
        console.error("Update Business Profile Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// DEACTIVATE BUSINESS
// ======================================================
//
// Your database does not have a `status` column.
//
// We use `is_trial = 0` here to represent disabled access.
// IMPORTANT: If your application uses is_trial specifically
// for subscription/trial logic, you may want a separate
// `is_active` column instead.
// ======================================================
exports.deactivateBusiness = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            "SELECT id, is_trial FROM businesses WHERE id = ?",
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        // Already disabled
        if (business[0].is_trial === 0) {
            return res.status(400).json({
                success: false,
                message: "Business is already deactivated"
            });
        }

        await db.query(
            "UPDATE businesses SET is_trial = 0 WHERE id = ?",
            [businessId]
        );

        return res.json({
            success: true,
            message: "Business deactivated successfully"
        });

    } catch (err) {
        console.error("Deactivate Business Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// REACTIVATE BUSINESS
// ======================================================
exports.reactivateBusiness = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [business] = await db.query(
            "SELECT id, is_trial FROM businesses WHERE id = ?",
            [businessId]
        );

        if (business.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        if (business[0].is_trial === 1) {
            return res.status(400).json({
                success: false,
                message: "Business is already active"
            });
        }

        await db.query(
            "UPDATE businesses SET is_trial = 1 WHERE id = ?",
            [businessId]
        );

        return res.json({
            success: true,
            message: "Business reactivated successfully"
        });

    } catch (err) {
        console.error("Reactivate Business Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// ======================================================
// ADMIN ONLY: GET ALL BUSINESSES
// ======================================================
exports.getAllBusinesses = async (req, res) => {
    try {
        // TODO:
        // Add admin middleware to the route.
        //
        // Example:
        // router.get(
        //     "/admin/businesses",
        //     authMiddleware,
        //     adminMiddleware,
        //     businessController.getAllBusinesses
        // );

        const [rows] = await db.query(
            `SELECT
                b.id,
                b.owner_id,
                b.business_name,
                b.business_type,
                b.owner_name,
                b.phone,
                b.email,
                b.gst_number,
                b.upi_id,
                b.address,
                b.city,
                b.state,
                b.pincode,
                b.logo,
                b.created_at,
                b.trial_start_date,
                b.expiry_date,
                b.plan,
                b.is_trial,
                u.full_name AS user_owner_name,
                u.email AS owner_email
            FROM businesses b
            INNER JOIN users u ON u.id = b.owner_id
            ORDER BY b.id DESC`
        );

        return res.json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("Get All Businesses Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};