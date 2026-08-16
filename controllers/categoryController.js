const db = require("../config/db");

// =============================
// Create Category
// =============================
exports.createCategory = async (req, res) => {
    try {
        const {
            category_name,
            category_image,
            description,
            status
        } = req.body;

        const businessId = req.businessId;

        if (!category_name) {
            return res.status(400).json({
                success: false,
                message: "Category Name is required."
            });
        }

        const [exist] = await db.query(
            `SELECT id
             FROM categories
             WHERE business_id=? AND category_name=?`,
            [businessId, category_name]
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
                businessId,
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

    } catch (err) {
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
        const businessId = req.businessId;

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

    } catch (err) {
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
        const businessId = req.businessId;

        const [rows] = await db.query(
            `SELECT *
             FROM categories
             WHERE id=? AND business_id=?`,
            [id, businessId]
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

    } catch (err) {
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
        const businessId = req.businessId;
        const {
            category_name,
            category_image,
            description,
            status
        } = req.body;

        // Check if category exists and belongs to the business
        const [check] = await db.query(
            `SELECT id
             FROM categories
             WHERE id=? AND business_id=?`,
            [id, businessId]
        );

        if (check.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found or you don't have permission"
            });
        }

        await db.query(
            `UPDATE categories
             SET
                category_name=?,
                category_image=?,
                description=?,
                status=?
             WHERE id=? AND business_id=?`,
            [
                category_name,
                category_image,
                description,
                status,
                id,
                businessId
            ]
        );

        res.json({
            success: true,
            message: "Category Updated Successfully"
        });

    } catch (err) {
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
        const businessId = req.businessId;

        // Check if category exists and belongs to the business
        const [check] = await db.query(
            `SELECT id
             FROM categories
             WHERE id=? AND business_id=?`,
            [id, businessId]
        );

        if (check.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found or you don't have permission"
            });
        }

        await db.query(
            `DELETE FROM categories
             WHERE id=? AND business_id=?`,
            [id, businessId]
        );

        res.json({
            success: true,
            message: "Category Deleted Successfully"
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};