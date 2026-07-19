const db = require("../config/db");

// =============================
// Create Category
// =============================

exports.createCategory = async (req, res) => {

    try {

        const {

            business_id,
            category_name,
            category_image,
            description,
            status

        } = req.body;

        if (!business_id || !category_name) {

            return res.status(400).json({

                success: false,

                message: "Business ID and Category Name are required."

            });

        }

        const [exist] = await db.query(

            `SELECT id
             FROM categories
             WHERE business_id=? AND category_name=?`,

            [business_id, category_name]

        );

        if (exist.length > 0) {

            return res.json({

                success: false,

                message: "Category already exists."

            });

        }

        const [result] = await db.query(

            `INSERT INTO categories
            (
                business_id,
                category_name,
                category_image,
                description,
                status
            )
            VALUES (?,?,?,?,?)`,

            [

                business_id,

                category_name,

                category_image || null,

                description || null,

                status || "active"

            ]

        );

        res.status(201).json({

            success: true,

            message: "Category Created Successfully",

            category_id: result.insertId

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


// =============================
// Get Categories
// =============================

exports.getCategories = async (req, res) => {

    try {

        const { businessId } = req.params;

        const [rows] = await db.query(

            `SELECT *
             FROM categories
             WHERE business_id=?
             ORDER BY id DESC`,

            [businessId]

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


// =============================
// Get Single Category
// =============================

exports.getCategoryById = async (req, res) => {

    try {

        const { id } = req.params;

        const [rows] = await db.query(

            `SELECT *
             FROM categories
             WHERE id=?`,

            [id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Category not found"

            });

        }

        res.json({

            success: true,

            data: rows[0]

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


// =============================
// Update Category
// =============================

exports.updateCategory = async (req, res) => {

    try {

        const { id } = req.params;

        const {

            category_name,
            category_image,
            description,
            status

        } = req.body;

        await db.query(

            `UPDATE categories
             SET

                category_name=?,

                category_image=?,

                description=?,

                status=?

             WHERE id=?`,

            [

                category_name,

                category_image,

                description,

                status,

                id

            ]

        );

        res.json({

            success: true,

            message: "Category Updated Successfully"

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


// =============================
// Delete Category
// =============================

exports.deleteCategory = async (req, res) => {

    try {

        const { id } = req.params;

        await db.query(

            `DELETE FROM categories
             WHERE id=?`,

            [id]

        );

        res.json({

            success: true,

            message: "Category Deleted Successfully"

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