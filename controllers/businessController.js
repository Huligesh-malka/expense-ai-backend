const db = require("../config/db");

// ===============================
// Create Business
// ===============================

exports.createBusiness = async (req, res) => {

    try {

        const {

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

        } = req.body;

        if (
            !owner_id ||
            !business_name ||
            !business_type
        ) {

            return res.status(400).json({

                success: false,
                message: "Business Name and Business Type are required."

            });

        }

        const [exist] = await db.query(

            "SELECT id FROM businesses WHERE owner_id=?",

            [owner_id]

        );

        if (exist.length > 0) {

            return res.json({

                success: false,
                message: "Business already exists."

            });

        }

        const [result] = await db.query(

            `INSERT INTO businesses
            (
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
            )
            VALUES
            (
                ?,?,?,?,?,?,?,?,?,?,?,?,?
            )`,

            [

                owner_id,
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

        res.status(201).json({

            success: true,
            message: "Business Created Successfully",

            business: {

                id: result.insertId,

                owner_id,

                business_name,

                business_type

            }

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// ===============================
// Get Business
// ===============================

exports.getBusiness = async (req, res) => {

    try {

        const { owner_id } = req.params;

        const [business] = await db.query(

            "SELECT * FROM businesses WHERE owner_id=?",

            [owner_id]

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

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// ===============================
// Update Business
// ===============================

exports.updateBusiness = async (req, res) => {

    try {

        const { id } = req.params;

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
            logo,
            status

        } = req.body;

        await db.query(

            `UPDATE businesses
            SET

                business_name=?,
                business_type=?,
                owner_name=?,
                phone=?,
                email=?,
                gst_number=?,
                upi_id=?,
                address=?,
                city=?,
                state=?,
                pincode=?,
                logo=?,
                status=?

            WHERE id=?`,

            [

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
                id

            ]

        );

        res.json({

            success: true,
            message: "Business Updated Successfully"

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// ===============================
// Delete Business
// ===============================

exports.deleteBusiness = async (req, res) => {

    try {

        const { id } = req.params;

        await db.query(

            "DELETE FROM businesses WHERE id=?",

            [id]

        );

        res.json({

            success: true,
            message: "Business Deleted Successfully"

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// ===============================
// Get All Businesses
// ===============================

exports.getAllBusinesses = async (req, res) => {

    try {

        const [rows] = await db.query(

            `SELECT
                id,
                business_name,
                business_type,
                owner_name,
                phone,
                city,
                state,
                status,
                created_at
            FROM businesses
            ORDER BY id DESC`

        );

        res.json({

            success: true,
            total: rows.length,
            data: rows

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};