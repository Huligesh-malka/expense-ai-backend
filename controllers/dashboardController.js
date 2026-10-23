
const db = require("../config/db");

// =====================================
// DASHBOARD
// =====================================
exports.getDashboard = async (req, res) => {
    try {
        const businessId = Number(req.businessId);

        if (!Number.isInteger(businessId) || businessId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid Business ID is required."
            });
        }

        // Run independent dashboard queries in parallel.
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
            // Total products
            db.query(
                `SELECT COUNT(*) AS total
                 FROM products
                 WHERE business_id = ?`,
                [businessId]
            ),

            // Low stock products
            db.query(
                `SELECT COUNT(*) AS total
                 FROM products
                 WHERE business_id = ?
                   AND stock <= min_stock
                   AND status = 'active'`,
                [businessId]
            ),

            // Total stock
            db.query(
                `SELECT COALESCE(SUM(stock), 0) AS total
                 FROM products
                 WHERE business_id = ?`,
                [businessId]
            ),

            // Inventory purchase value
            db.query(
                `SELECT CAST(
                    COALESCE(SUM(stock * purchase_price), 0)
                    AS DECIMAL(15, 2)
                 ) AS total
                 FROM products
                 WHERE business_id = ?`,
                [businessId]
            ),

            // Active products
            db.query(
                `SELECT COUNT(*) AS total
                 FROM products
                 WHERE business_id = ?
                   AND status = 'active'`,
                [businessId]
            ),

            // Inactive products
            db.query(
                `SELECT COUNT(*) AS total
                 FROM products
                 WHERE business_id = ?
                   AND status = 'inactive'`,
                [businessId]
            ),

            // Total categories
            db.query(
                `SELECT COUNT(DISTINCT category) AS total
                 FROM products
                 WHERE business_id = ?
                   AND category IS NOT NULL
                   AND category <> ''`,
                [businessId]
            ),

            // Today's paid sales
            db.query(
                `SELECT CAST(
                    COALESCE(SUM(total_amount), 0)
                    AS DECIMAL(15, 2)
                 ) AS total
                 FROM sales
                 WHERE business_id = ?
                   AND payment_status = 'Paid'
                   AND created_at >= CURDATE()
                   AND created_at < CURDATE() + INTERVAL 1 DAY`,
                [businessId]
            ),

            // Current month's paid sales
            db.query(
                `SELECT CAST(
                    COALESCE(SUM(total_amount), 0)
                    AS DECIMAL(15, 2)
                 ) AS total
                 FROM sales
                 WHERE business_id = ?
                   AND payment_status = 'Paid'
                   AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                   AND created_at < DATE_FORMAT(
                       CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01'
                   )`,
                [businessId]
            ),

            // All-time paid sales
            db.query(
                `SELECT CAST(
                    COALESCE(SUM(total_amount), 0)
                    AS DECIMAL(15, 2)
                 ) AS total
                 FROM sales
                 WHERE business_id = ?
                   AND payment_status = 'Paid'`,
                [businessId]
            ),

            // Total customers
            db.query(
                `SELECT COUNT(*) AS total
                 FROM customers
                 WHERE business_id = ?`,
                [businessId]
            ),

            // Total suppliers
            db.query(
                `SELECT COUNT(*) AS total
                 FROM suppliers
                 WHERE business_id = ?`,
                [businessId]
            )
        ]);

        // Preserve the existing response field names.
        res.json({
            success: true,
            totalProducts: Number(products[0].total) || 0,
            totalCategories: Number(categories[0].total) || 0,
            todaySales: Number(todaySales[0].total) || 0,
            monthSales: Number(monthSales[0].total) || 0,
            totalSales: Number(totalSales[0].total) || 0,
            totalCustomers: Number(customers[0].total) || 0,
            totalSuppliers: Number(suppliers[0].total) || 0,
            lowStock: Number(lowStock[0].total) || 0,
            totalStock: Number(stock[0].total) || 0,
            inventoryValue: Number(inventory[0].total) || 0,
            activeProducts: Number(active[0].total) || 0,
            inactiveProducts: Number(inactive[0].total) || 0
        });
    } catch (err) {
        console.error("Dashboard Error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load dashboard data"
        });
    }
};

// =====================================
// RECENT SALES
// =====================================
exports.getRecentSales = async (req, res) => {
    try {
        // Use the authenticated business ID, not a client-supplied ID.
        const businessId = Number(req.businessId);

        if (!Number.isInteger(businessId) || businessId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid Business ID is required."
            });
        }

        const [sales] = await db.query(
            `SELECT
                s.id,
                s.invoice_no,
                CAST(s.total_amount AS DECIMAL(15, 2)) AS total_amount,
                s.payment_method,
                s.payment_status,
                s.created_at,
                COUNT(si.id) AS items
             FROM sales s
             LEFT JOIN sale_items si
                ON s.id = si.sale_id
             WHERE s.business_id = ?
             GROUP BY
                s.id,
                s.invoice_no,
                s.total_amount,
                s.payment_method,
                s.payment_status,
                s.created_at
             ORDER BY s.created_at DESC, s.id DESC
             LIMIT 10`,
            [businessId]
        );

        return res.json({
            success: true,
            data: sales.map(sale => ({
                ...sale,
                total_amount: Number(sale.total_amount),
                items: Number(sale.items)
            }))
        });
    } catch (err) {
        console.error("Recent Sales Error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch recent sales"
        });
    }
};
