const db = require("../config/db");

// =====================================
// CREATE SUPPLIER
// =====================================

exports.createSupplier = async (req, res) => {
    try {
        const businessId = req.businessId;

        const {
            supplier_name,
            company_name,
            supplier_phone,
            supplier_email,
            gst_number,
            address,
            city,
            state,
            pincode,
            opening_balance,
            notes
        } = req.body;

        if (!supplier_name) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required"
            });
        }

        if (!supplier_phone) {
            return res.status(400).json({
                success: false,
                message: "Supplier phone is required"
            });
        }

        // Check duplicate supplier
        const [existing] = await db.query(
            `SELECT id
             FROM suppliers
             WHERE business_id=?
             AND supplier_phone=?`,
            [businessId, supplier_phone]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Supplier already exists"
            });
        }

        const [result] = await db.query(
            `INSERT INTO suppliers
            (
                business_id,
                supplier_name,
                company_name,
                supplier_phone,
                supplier_email,
                gst_number,
                address,
                city,
                state,
                pincode,
                opening_balance,
                notes
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                businessId,
                supplier_name,
                company_name || null,
                supplier_phone,
                supplier_email || null,
                gst_number || null,
                address || null,
                city || null,
                state || null,
                pincode || null,
                opening_balance || 0,
                notes || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Supplier created successfully",
            supplierId: result.insertId
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// GET ALL SUPPLIERS
// =====================================

exports.getSuppliers = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [suppliers] = await db.query(
            `SELECT
                s.id,
                s.supplier_name,
                s.company_name,
                s.supplier_phone,
                s.supplier_email,
                s.gst_number,
                s.city,
                s.status,
                s.created_at,

                -- Calculate actual outstanding supplier balance
                COALESCE(
                    (
                        SELECT SUM(p.due_amount)
                        FROM purchases p
                        WHERE p.supplier_id = s.id
                        AND p.business_id = s.business_id
                    ),
                    0
                ) AS balance_due

            FROM suppliers s
            WHERE s.business_id = ?
            ORDER BY s.id DESC`,
            [businessId]
        );

        res.json({
            success: true,
            total: suppliers.length,
            data: suppliers
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// GET SINGLE SUPPLIER
// =====================================

exports.getSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        const [supplier] = await db.query(
            `SELECT
                id,
                business_id,
                supplier_name,
                company_name,
                supplier_phone,
                supplier_email,
                gst_number,
                address,
                city,
                state,
                pincode,
                opening_balance,
                notes,
                status,
                created_at,
                updated_at
            FROM suppliers
            WHERE id=?
            AND business_id=?`,
            [id, businessId]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        res.json({
            success: true,
            data: supplier[0]
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// UPDATE SUPPLIER
// =====================================

exports.updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        const {
            supplier_name,
            company_name,
            supplier_phone,
            supplier_email,
            gst_number,
            address,
            city,
            state,
            pincode,
            opening_balance,
            notes,
            status
        } = req.body;

        // Check Supplier belongs to this business
        const [supplier] = await db.query(
            "SELECT * FROM suppliers WHERE id=? AND business_id=?",
            [id, businessId]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        // Duplicate Phone Check
        if (supplier_phone) {
            const [exist] = await db.query(
                `SELECT id
                 FROM suppliers
                 WHERE supplier_phone=?
                 AND id<>?
                 AND business_id=?`,
                [supplier_phone, id, businessId]
            );

            if (exist.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number already exists"
                });
            }
        }

        await db.query(
            `UPDATE suppliers
             SET
                supplier_name=?,
                company_name=?,
                supplier_phone=?,
                supplier_email=?,
                gst_number=?,
                address=?,
                city=?,
                state=?,
                pincode=?,
                opening_balance=?,
                notes=?,
                status=?
             WHERE id=?
             AND business_id=?`,
            [
                supplier_name || supplier[0].supplier_name,
                company_name || supplier[0].company_name,
                supplier_phone || supplier[0].supplier_phone,
                supplier_email || supplier[0].supplier_email,
                gst_number || supplier[0].gst_number,
                address || supplier[0].address,
                city || supplier[0].city,
                state || supplier[0].state,
                pincode || supplier[0].pincode,
                opening_balance ?? supplier[0].opening_balance,
                notes || supplier[0].notes,
                status || supplier[0].status,
                id,
                businessId
            ]
        );

        res.json({
            success: true,
            message: "Supplier updated successfully"
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// UPDATE SUPPLIER STATUS
// ACTIVE / INACTIVE
// =====================================

exports.updateSupplierStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const businessId = req.businessId;

        // Validate status
        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or inactive"
            });
        }

        // Check supplier belongs to this business
        const [supplier] = await db.query(
            `SELECT id, supplier_name, status
            FROM suppliers
            WHERE id=?
            AND business_id=?`,
            [id, businessId]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        // Update only status
        await db.query(
            `UPDATE suppliers
            SET status=?
            WHERE id=?
            AND business_id=?`,
            [status, id, businessId]
        );

        res.json({
            success: true,
            message:
                status === "active"
                    ? "Supplier activated successfully"
                    : "Supplier made inactive successfully",
            data: {
                id: supplier[0].id,
                supplier_name: supplier[0].supplier_name,
                status: status
            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// SUPPLIER DASHBOARD
// =====================================

exports.getSupplierDashboard = async (req, res) => {
    try {
        const businessId = req.businessId;

        const [[totalSuppliers]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM suppliers
             WHERE business_id=?`,
            [businessId]
        );

        const [[activeSuppliers]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM suppliers
             WHERE business_id=?
             AND status='active'`,
            [businessId]
        );

        const [[inactiveSuppliers]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM suppliers
             WHERE business_id=?
             AND status='inactive'`,
            [businessId]
        );

        const [[openingBalance]] = await db.query(
            `SELECT
                IFNULL(SUM(opening_balance),0) AS total
             FROM suppliers
             WHERE business_id=?`,
            [businessId]
        );

        res.json({
            success: true,
            data: {
                total_suppliers: totalSuppliers.total,
                active_suppliers: activeSuppliers.total,
                inactive_suppliers: inactiveSuppliers.total,
                total_opening_balance: openingBalance.total
            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};