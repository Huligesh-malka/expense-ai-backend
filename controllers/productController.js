const db = require("../config/db");

// ============================
// Create Product
// ============================

exports.createProduct = async (req, res) => {
    try {
        const businessId = Number(req.businessId);
        
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
            expiry_date
        } = req.body;

        // Trim text fields
        if (product_name) product_name = product_name.trim();
        if (category) category = category.trim();
        if (product_code) product_code = product_code.trim();
        if (barcode) barcode = barcode.trim();
        if (description) description = description.trim();

        // Convert to numbers
        purchase_price = Number(purchase_price) || 0;
        selling_price = Number(selling_price) || 0;
        price_per = Number(price_per) || 1;
        stock = Number(stock) || 0;
        min_stock = Number(min_stock) || 5;
        tax = Number(tax) || 0;

        // Validate required fields
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
            [businessId, product_name]
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
                [businessId, barcode]
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
                businessId,
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
            "SELECT * FROM products WHERE id = ? AND business_id = ?",
            [result.insertId, businessId]
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
// Get Products (NO LIMIT - returns all products)
// ============================

exports.getProducts = async (req, res) => {
    try {
        const businessId = req.businessId;
        
        // Search/filter parameters
        const search = req.query.search || '';
        const status = req.query.status || 'active';
        const category = req.query.category || '';

        let query = `SELECT * FROM products WHERE business_id=?`;
        let params = [businessId];

        // Add status filter
        if (status) {
            query += ` AND status=?`;
            params.push(status);
        }

        // Add category filter
        if (category) {
            query += ` AND category=?`;
            params.push(category);
        }

        // Add search filter
        if (search) {
            query += ` AND (product_name LIKE ? OR product_code LIKE ? OR barcode LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // Add ordering (no pagination)
        query += ` ORDER BY id DESC`;

        const [rows] = await db.query(query, params);

        res.json({
            success: true,
            total: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("Get Products Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products"
        });
    }
};

// ============================
// Get Product By Id
// ============================

exports.getProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        const [rows] = await db.query(
            `SELECT *
             FROM products
             WHERE id=?
             AND business_id=?
             LIMIT 1`,
            [id, businessId]
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
        console.error("Get Product Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product"
        });
    }
};

// ============================
// Update Product
// ============================

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

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

        // Check Product - SECURED with business_id
        const [product] = await db.query(
            `SELECT *
             FROM products
             WHERE id=?
             AND business_id=?
             LIMIT 1`,
            [id, businessId]
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

        // Duplicate Product Name - SECURED with business_id
        const [exist] = await db.query(
            `SELECT id
            FROM products
            WHERE business_id=?
            AND product_name=?
            AND id<>?`,
            [
                businessId,
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

        // Duplicate Barcode - SECURED with business_id
        if (barcode) {
            const [barcodeExist] = await db.query(
                `SELECT id
                 FROM products
                 WHERE business_id=?
                 AND barcode=?
                 AND id<>?`,
                [
                    businessId,
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

        // Update - SECURED with business_id
        const [updateResult] = await db.query(
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
            WHERE id=?
            AND business_id=?`,
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
                id,
                businessId
            ]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found or no changes made"
            });
        }

        // Fetch and return the updated product - SECURED with business_id
        const [updatedProduct] = await db.query(
            "SELECT * FROM products WHERE id = ? AND business_id = ?",
            [id, businessId]
        );

        res.json({
            success: true,
            message: "Product Updated Successfully",
            data: updatedProduct[0]
        });

    } catch (err) {
        console.error("Update Product Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to update product"
        });
    }
};

// ============================
// Delete Product
// ============================

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        // Check if product exists and belongs to business
        const [product] = await db.query(
            `SELECT id FROM products
             WHERE id=?
             AND business_id=?`,
            [id, businessId]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const [result] = await db.query(
            `DELETE FROM products
             WHERE id=?
             AND business_id=?`,
            [id, businessId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product Deleted Successfully"
        });

    } catch (err) {
        console.error("Delete Product Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete product"
        });
    }
};

// ============================
// Get Products by Category
// ============================

exports.getProductsByCategory = async (req, res) => {
    try {
        const businessId = req.businessId;
        const { category } = req.query;
        const status = req.query.status || 'active';

        let query = "SELECT * FROM products WHERE business_id=?";
        let params = [businessId];

        // Add status filter
        if (status) {
            query += " AND status=?";
            params.push(status);
        }

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
        console.error("Get Products By Category Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products by category"
        });
    }
};

// ============================
// GET PRODUCT BY BARCODE
// ============================

exports.getProductByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        const businessId = req.businessId;

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
                businessId,
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
        console.error("Get Product By Barcode Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch product by barcode"
        });
    }
};

// ============================
// GET LOW STOCK PRODUCTS
// ============================

exports.getLowStockProducts = async (req, res) => {
    try {
        const businessId = req.businessId;
        const threshold = parseInt(req.query.threshold) || 5;

        const [rows] = await db.query(
            `SELECT *
             FROM products
             WHERE business_id=?
             AND stock <= min_stock
             AND status='active'
             ORDER BY stock ASC`,
            [businessId]
        );

        res.json({
            success: true,
            total: rows.length,
            threshold,
            data: rows
        });

    } catch (err) {
        console.error("Get Low Stock Products Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch low stock products"
        });
    }
};