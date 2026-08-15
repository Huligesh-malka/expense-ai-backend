const db = require("../config/db");

// ============================
// Create Product
// ============================

exports.createProduct = async (req, res) => {
    try {
        let {
            business_id,
            category,
            product_name,
            product_code,
            barcode,
            purchase_price,
            selling_price,
            price_per,
            price_unit,
            stock,
            min_stock,
            unit,
            tax,
            image,
            description,
            expiry_date
        } = req.body;

        // Trim text fields
        if (product_name) product_name = product_name.trim();
        if (category) category = category.trim();
        if (product_code) product_code = product_code.trim();
        if (barcode) barcode = barcode.trim();
        if (description) description = description.trim();

        // Convert to numbers
        business_id = Number(business_id);
        purchase_price = Number(purchase_price) || 0;
        selling_price = Number(selling_price) || 0;
        price_per = Number(price_per) || 1;
        stock = Number(stock) || 0;
        min_stock = Number(min_stock) || 5;
        tax = Number(tax) || 0;

        // Validate required fields
        if (!business_id || isNaN(business_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid Business ID is required."
            });
        }

        if (!product_name || product_name === "") {
            return res.status(400).json({
                success: false,
                message: "Product Name is required."
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Category is required."
            });
        }

        if (selling_price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Selling Price must be greater than 0."
            });
        }

        // Validate price_per
        if (price_per <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price Per must be greater than 0."
            });
        }

        // Validate stock
        if (stock < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock cannot be negative."
            });
        }

        // Validate minimum stock
        if (min_stock < 0) {
            return res.status(400).json({
                success: false,
                message: "Minimum stock cannot be negative."
            });
        }

        // Validate price_unit
        const validUnits = ['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'dozen', 'meter', 'feet'];
        if (price_unit && !validUnits.includes(price_unit)) {
            return res.status(400).json({
                success: false,
                message: "Invalid price unit. Valid units: " + validUnits.join(', ')
            });
        }

        // Validate unit
        if (unit && !validUnits.includes(unit)) {
            return res.status(400).json({
                success: false,
                message: "Invalid stock unit. Valid units: " + validUnits.join(', ')
            });
        }

        // Check for existing product
        const [exist] = await db.query(
            `SELECT id FROM products 
            WHERE business_id=? AND product_name=?`,
            [business_id, product_name]
        );

        if (exist.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Product already exists."
            });
        }

        // Check for duplicate barcode if provided
        if (barcode) {
            const [existingBarcode] = await db.query(
                `SELECT id FROM products
                 WHERE business_id=? AND barcode=?`,
                [business_id, barcode]
            );

            if (existingBarcode.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Barcode already exists for another product in this business."
                });
            }
        }

        // Insert product
        const [result] = await db.query(
            `INSERT INTO products (
                business_id, category, product_name, product_code, 
                barcode, purchase_price, selling_price, price_per,
                price_unit, stock, min_stock, unit, tax, image, description, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                business_id,
                category,
                product_name,
                product_code || null,
                barcode || null,
                purchase_price,
                selling_price,
                price_per,
                price_unit || 'pcs',
                stock,
                min_stock,
                unit || "pcs",
                tax,
                image || null,
                description || null,
                expiry_date || null
            ]
        );

        // Fetch and return the created product
        const [newProduct] = await db.query(
            "SELECT * FROM products WHERE id = ?",
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Product Created Successfully",
            data: newProduct[0]
        });

    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({
            success: false,
            message: err.message || "Internal server error"
        });
    }
};

// ============================
// Get Products
// ============================

exports.getProducts = async (req, res) => {
    try {
        const businessId = req.query.business_id;

        const [rows] = await db.query(
            `SELECT *
            FROM products
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

// ============================
// Get Product By Id
// ============================

exports.getProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            "SELECT * FROM products WHERE id=?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
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

// ============================
// Update Product
// ============================

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        let {
            category,
            product_name,
            product_code,
            barcode,
            purchase_price,
            selling_price,
            price_per,
            price_unit,
            stock,
            min_stock,
            unit,
            tax,
            image,
            description,
            status,
            expiry_date
        } = req.body;

        // Trim text fields
        if (product_name) product_name = product_name.trim();
        if (category) category = category.trim();
        if (product_code) product_code = product_code.trim();
        if (barcode) barcode = barcode.trim();
        if (description) description = description.trim();

        purchase_price = Number(purchase_price) || 0;
        selling_price = Number(selling_price) || 0;
        price_per = Number(price_per) || 1;
        stock = Number(stock) || 0;
        min_stock = Number(min_stock) || 5;
        tax = Number(tax) || 0;

        // Validate price_per
        if (price_per <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price Per must be greater than 0."
            });
        }

        // Validate stock
        if (stock < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock cannot be negative."
            });
        }

        // Validate minimum stock
        if (min_stock < 0) {
            return res.status(400).json({
                success: false,
                message: "Minimum stock cannot be negative."
            });
        }

        // Validate price_unit
        const validUnits = ['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'dozen', 'meter', 'feet'];
        if (price_unit && !validUnits.includes(price_unit)) {
            return res.status(400).json({
                success: false,
                message: "Invalid price unit. Valid units: " + validUnits.join(', ')
            });
        }

        // Validate unit
        if (unit && !validUnits.includes(unit)) {
            return res.status(400).json({
                success: false,
                message: "Invalid stock unit. Valid units: " + validUnits.join(', ')
            });
        }

        // Check Product
        const [product] = await db.query(
            "SELECT * FROM products WHERE id=?",
            [id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        if (!product_name || product_name === "") {
            return res.status(400).json({
                success: false,
                message: "Product Name is required."
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Category is required."
            });
        }

        if (selling_price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Selling Price must be greater than 0."
            });
        }

        // Duplicate Product Name
        const [exist] = await db.query(
            `SELECT id
            FROM products
            WHERE business_id=?
            AND product_name=?
            AND id<>?`,
            [
                product[0].business_id,
                product_name,
                id
            ]
        );

        if (exist.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Product name already exists."
            });
        }

        // Duplicate Barcode
        if (barcode) {
            const [barcodeExist] = await db.query(
                `SELECT id
                 FROM products
                 WHERE business_id=?
                 AND barcode=?
                 AND id<>?`,
                [
                    product[0].business_id,
                    barcode,
                    id
                ]
            );

            if (barcodeExist.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Barcode already exists for another product."
                });
            }
        }

        await db.query(
            `UPDATE products
            SET
                category=?,
                product_name=?,
                product_code=?,
                barcode=?,
                purchase_price=?,
                selling_price=?,
                price_per=?,
                price_unit=?,
                stock=?,
                min_stock=?,
                unit=?,
                tax=?,
                image=?,
                description=?,
                expiry_date=?,
                status=?
            WHERE id=?`,
            [
                category,
                product_name,
                product_code || null,
                barcode || null,
                purchase_price,
                selling_price,
                price_per,
                price_unit || 'pcs',
                stock,
                min_stock,
                unit || "pcs",
                tax,
                image || null,
                description || null,
                expiry_date || null,
                status || "active",
                id
            ]
        );

        // Fetch and return the updated product
        const [updatedProduct] = await db.query(
            "SELECT * FROM products WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Product Updated Successfully",
            data: updatedProduct[0]
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ============================
// Delete Product
// ============================

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            "DELETE FROM products WHERE id=?",
            [id]
        );

        res.json({
            success: true,
            message: "Product Deleted Successfully"
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ============================
// Get Products by Category
// ============================

exports.getProductsByCategory = async (req, res) => {
    try {
        const { business_id, category } = req.query;

        let query = "SELECT * FROM products WHERE business_id=?";
        let params = [business_id];

        if (category) {
            query += " AND category=?";
            params.push(category);
        }

        query += " ORDER BY product_name ASC";

        const [rows] = await db.query(query, params);

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

// =====================================
// GET PRODUCT BY BARCODE
// =====================================

exports.getProductByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        const business_id = req.query.business_id;

        if (!business_id) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

        if (!barcode) {
            return res.status(400).json({
                success: false,
                message: "Barcode is required"
            });
        }

        const [rows] = await db.query(
            `SELECT *
             FROM products
             WHERE business_id = ?
             AND barcode = ?
             AND status='active'
             LIMIT 1`,
            [
                business_id,
                barcode
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
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