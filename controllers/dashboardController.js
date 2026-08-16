const db = require("../config/db");

exports.getDashboard = async (req, res) => {
    try {
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required."
            });
        }

        // Get all dashboard data in parallel for better performance
        const [
            [products],
            [lowStock],
            [stock],
            [inventory],
            [active],
            [inactive],
            [categories],
            [todaySales],
            [monthSales],
            [totalSales],
            [customers],
            [suppliers]
        ] = await Promise.all([
            // Total Products
            db.query("SELECT COUNT(*) AS total FROM products WHERE business_id=?", [businessId]),
            
            // Low Stock
            db.query(
                `SELECT COUNT(*) AS total 
                 FROM products 
                 WHERE business_id=? AND stock <= min_stock`,
                [businessId]
            ),
            
            // Total Stock
            db.query(
                `SELECT IFNULL(SUM(stock), 0) AS total 
                 FROM products 
                 WHERE business_id=?`,
                [businessId]
            ),
            
            // Inventory Value
            db.query(
                `SELECT IFNULL(SUM(stock * purchase_price), 0) AS total 
                 FROM products 
                 WHERE business_id=?`,
                [businessId]
            ),
            
            // Active Products
            db.query(
                `SELECT COUNT(*) AS total 
                 FROM products 
                 WHERE business_id=? AND status='active'`,
                [businessId]
            ),
            
            // Inactive Products
            db.query(
                `SELECT COUNT(*) AS total 
                 FROM products 
                 WHERE business_id=? AND status='inactive'`,
                [businessId]
            ),
            
            // Total Categories
            db.query(
                `SELECT COUNT(DISTINCT category) AS total 
                 FROM products 
                 WHERE business_id=? AND category IS NOT NULL AND category != ''`,
                [businessId]
            ),
            
            // Today's Sales
            db.query(
    `SELECT IFNULL(SUM(total_amount), 0) AS total
     FROM sales
     WHERE business_id=?
     AND created_at >= CURDATE()
     AND created_at < CURDATE() + INTERVAL 1 DAY`,
    [businessId]
),
            
            // Month's Sales
            db.query(
                `SELECT IFNULL(SUM(total_amount), 0) AS total 
                 FROM sales 
                 WHERE business_id=? 
                 AND MONTH(created_at) = MONTH(CURDATE()) 
                 AND YEAR(created_at) = YEAR(CURDATE())`,
                [businessId]
            ),
            
            // Total Sales (All time)
            db.query(
                `SELECT IFNULL(SUM(total_amount), 0) AS total 
                 FROM sales 
                 WHERE business_id=?`,
                [businessId]
            ),
            
            // Total Customers
            db.query(
                `SELECT COUNT(*) AS total 
                 FROM customers 
                 WHERE business_id=?`,
                [businessId]
            ),
            
            // Total Suppliers
            db.query(
                `SELECT COUNT(*) AS total 
                 FROM suppliers 
                 WHERE business_id=?`,
                [businessId]
            )
        ]);

        res.json({
            success: true,
            totalProducts: products[0].total || 0,
            totalCategories: categories[0].total || 0,
            todaySales: todaySales[0].total || 0,
            monthSales: monthSales[0].total || 0,
            totalSales: totalSales[0].total || 0,
            totalCustomers: customers[0].total || 0,
            totalSuppliers: suppliers[0].total || 0,
            lowStock: lowStock[0].total || 0,
            totalStock: stock[0].total || 0,
            inventoryValue: inventory[0].total || 0,
            activeProducts: active[0].total || 0,
            inactiveProducts: inactive[0].total || 0
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to load dashboard data"
        });
    }
};
exports.getRecentSales = async (req, res) => {

    try {

        const businessId = Number(req.query.business_id);

        const [sales] = await db.query(

            `SELECT
                s.id,
                s.invoice_no,
                s.total_amount,
                s.payment_method,
                s.payment_status,
                s.created_at,
                COUNT(si.id) AS items
             FROM sales s
             LEFT JOIN sale_items si
             ON s.id = si.sale_id
             WHERE s.business_id=?
             GROUP BY s.id
             ORDER BY s.created_at DESC
             LIMIT 10`,

            [businessId]

        );

        res.json({

            success:true,
            data:sales

        });

    }

    catch(err){

        console.log(err);

        res.status(500).json({

            success:false,
            message:err.message

        });

    }

};