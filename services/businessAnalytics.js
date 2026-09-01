const db = require("../config/db");

// ============================================================
// BUSINESS ANALYTICS ENGINE
// ============================================================
// This is STEP 1 of the AI Business Strategy Engine.
//
// It collects data from your existing database:
// - Sales
// - Products
// - Inventory
// - Customers
// - Suppliers
// - Purchases
// - Product performance
//
// This file does NOT use AI yet.
// Step 2 will send this data to the AI engine.
// ============================================================


exports.getBusinessAnalytics = async (businessId) => {
    try {

        if (!businessId) {
            throw new Error("Business ID is required");
        }

        // =====================================================
        // RUN DATABASE QUERIES IN PARALLEL
        // =====================================================

        const [
            [todaySales],
            [currentMonthSales],
            [previousMonthSales],
            [productStats],
            [lowStockProducts],
            [productSales],
            [customerStats],
            [topCustomers],
            [inactiveCustomers],
            [supplierStats],
            [categorySales],
            [paymentMethods],
            [dailySales],
            [purchaseStats],
            [monthlyPurchases]
        ] = await Promise.all([

            // =================================================
            // TODAY SALES
            // =================================================

            db.query(`
                SELECT
                    COUNT(*) AS orders,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(discount), 0) AS discount,
                    COALESCE(SUM(tax), 0) AS tax,
                    COALESCE(AVG(total_amount), 0) AS average_order_value
                FROM sales
                WHERE business_id = ?
                AND created_at >= CURDATE()
                AND created_at < CURDATE() + INTERVAL 1 DAY
            `, [businessId]),


            // =================================================
            // CURRENT MONTH SALES
            // =================================================

            db.query(`
                SELECT
                    COUNT(*) AS orders,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(discount), 0) AS discount,
                    COALESCE(SUM(tax), 0) AS tax,
                    COALESCE(AVG(total_amount), 0) AS average_order_value
                FROM sales
                WHERE business_id = ?
                AND created_at >= DATE_FORMAT(
                    CURDATE(),
                    '%Y-%m-01'
                )
                AND created_at < DATE_FORMAT(
                    CURDATE() + INTERVAL 1 MONTH,
                    '%Y-%m-01'
                )
            `, [businessId]),


            // =================================================
            // PREVIOUS MONTH SALES
            // =================================================

            db.query(`
                SELECT
                    COUNT(*) AS orders,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(discount), 0) AS discount,
                    COALESCE(SUM(tax), 0) AS tax,
                    COALESCE(AVG(total_amount), 0) AS average_order_value
                FROM sales
                WHERE business_id = ?
                AND created_at >= DATE_FORMAT(
                    CURDATE() - INTERVAL 1 MONTH,
                    '%Y-%m-01'
                )
                AND created_at < DATE_FORMAT(
                    CURDATE(),
                    '%Y-%m-01'
                )
            `, [businessId]),


            // =================================================
            // PRODUCT / INVENTORY STATISTICS
            // =================================================

            db.query(`
                SELECT

                    COUNT(*) AS total_products,

                    SUM(
                        CASE
                            WHEN status = 'active'
                            THEN 1
                            ELSE 0
                        END
                    ) AS active_products,

                    SUM(
                        CASE
                            WHEN status = 'inactive'
                            THEN 1
                            ELSE 0
                        END
                    ) AS inactive_products,

                    COUNT(
                        DISTINCT CASE
                            WHEN category IS NOT NULL
                            AND category != ''
                            THEN category
                        END
                    ) AS total_categories,

                    COALESCE(
                        SUM(stock),
                        0
                    ) AS total_stock,

                    COALESCE(
                        SUM(stock * purchase_price),
                        0
                    ) AS inventory_purchase_value,

                    COALESCE(
                        SUM(stock * selling_price),
                        0
                    ) AS inventory_selling_value

                FROM products
                WHERE business_id = ?
            `, [businessId]),


            // =================================================
            // LOW STOCK PRODUCTS
            // =================================================

            db.query(`
                SELECT
                    id,
                    product_name,
                    category,
                    stock,
                    min_stock,
                    purchase_price,
                    selling_price,
                    expiry_date
                FROM products
                WHERE business_id = ?
                AND status = 'active'
                AND stock <= min_stock
                ORDER BY stock ASC
                LIMIT 100
            `, [businessId]),


            // =================================================
            // PRODUCT SALES - LAST 30 DAYS
            // =================================================

            db.query(`
                SELECT

                    si.product_id,

                    si.product_name,

                    COALESCE(
                        SUM(si.base_quantity),
                        0
                    ) AS units_sold,

                    COALESCE(
                        SUM(si.total),
                        0
                    ) AS revenue

                FROM sale_items si

                INNER JOIN sales s
                    ON s.id = si.sale_id

                WHERE s.business_id = ?

                AND s.created_at >=
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL 30 DAY
                    )

                GROUP BY
                    si.product_id,
                    si.product_name

                ORDER BY
                    units_sold DESC

                LIMIT 100
            `, [businessId]),


            // =================================================
            // CUSTOMER STATISTICS
            // =================================================

            db.query(`
                SELECT

                    COUNT(*) AS total_customers,

                    COALESCE(
                        SUM(total_orders),
                        0
                    ) AS total_orders,

                    COALESCE(
                        SUM(total_spent),
                        0
                    ) AS total_spent,

                    COALESCE(
                        AVG(total_spent),
                        0
                    ) AS average_customer_value

                FROM customers
                WHERE business_id = ?
            `, [businessId]),


            // =================================================
            // TOP CUSTOMERS
            // =================================================

            db.query(`
                SELECT

                    id,
                    customer_name,
                    customer_phone,
                    total_orders,
                    total_spent,
                    last_purchase,
                    status

                FROM customers

                WHERE business_id = ?

                ORDER BY total_spent DESC

                LIMIT 20
            `, [businessId]),


            // =================================================
            // CUSTOMERS INACTIVE FOR 60+ DAYS
            // =================================================

            db.query(`
                SELECT
                    COUNT(*) AS total
                FROM customers
                WHERE business_id = ?
                AND (
                    last_purchase IS NULL
                    OR last_purchase <
                        DATE_SUB(
                            NOW(),
                            INTERVAL 60 DAY
                        )
                )
            `, [businessId]),


            // =================================================
            // SUPPLIER STATISTICS
            // =================================================

            db.query(`
                SELECT

                    COUNT(*) AS total_suppliers,

                    SUM(
                        CASE
                            WHEN status = 'active'
                            THEN 1
                            ELSE 0
                        END
                    ) AS active_suppliers,

                    SUM(
                        CASE
                            WHEN status = 'inactive'
                            THEN 1
                            ELSE 0
                        END
                    ) AS inactive_suppliers

                FROM suppliers
                WHERE business_id = ?
            `, [businessId]),


            // =================================================
            // SALES BY CATEGORY - LAST 30 DAYS
            // =================================================

            db.query(`
                SELECT

                    p.category,

                    COALESCE(
                        SUM(si.base_quantity),
                        0
                    ) AS units_sold,

                    COALESCE(
                        SUM(si.total),
                        0
                    ) AS revenue

                FROM sale_items si

                INNER JOIN sales s
                    ON s.id = si.sale_id

                INNER JOIN products p
                    ON p.id = si.product_id
                    AND p.business_id = s.business_id

                WHERE s.business_id = ?

                AND s.created_at >=
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL 30 DAY
                    )

                AND p.category IS NOT NULL

                AND p.category != ''

                GROUP BY
                    p.category

                ORDER BY
                    revenue DESC
            `, [businessId]),


            // =================================================
            // PAYMENT METHODS - LAST 30 DAYS
            // =================================================

            db.query(`
                SELECT

                    COALESCE(
                        payment_method,
                        'Unknown'
                    ) AS payment_method,

                    COUNT(*) AS orders,

                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS revenue

                FROM sales

                WHERE business_id = ?

                AND created_at >=
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL 30 DAY
                    )

                GROUP BY
                    payment_method

                ORDER BY
                    revenue DESC
            `, [businessId]),


            // =================================================
            // DAILY SALES - LAST 30 DAYS
            // =================================================

            db.query(`
                SELECT

                    DATE(created_at) AS date,

                    COUNT(*) AS orders,

                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS revenue,

                    COALESCE(
                        SUM(discount),
                        0
                    ) AS discount,

                    COALESCE(
                        SUM(tax),
                        0
                    ) AS tax

                FROM sales

                WHERE business_id = ?

                AND created_at >=
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL 30 DAY
                    )

                GROUP BY
                    DATE(created_at)

                ORDER BY
                    date ASC
            `, [businessId]),


            // =================================================
            // PURCHASE STATISTICS
            // =================================================

            db.query(`
                SELECT

                    COUNT(*) AS total_purchases,

                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS total_purchase_value,

                    COALESCE(
                        SUM(paid_amount),
                        0
                    ) AS total_paid,

                    COALESCE(
                        SUM(due_amount),
                        0
                    ) AS total_due,

                    COALESCE(
                        AVG(total_amount),
                        0
                    ) AS average_purchase_value

                FROM purchases

                WHERE business_id = ?
            `, [businessId]),


            // =================================================
            // MONTHLY PURCHASES - LAST 12 MONTHS
            // =================================================

            db.query(`
                SELECT

                    DATE_FORMAT(
                        created_at,
                        '%Y-%m'
                    ) AS month,

                    COUNT(*) AS purchases,

                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS amount,

                    COALESCE(
                        SUM(paid_amount),
                        0
                    ) AS paid,

                    COALESCE(
                        SUM(due_amount),
                        0
                    ) AS due

                FROM purchases

                WHERE business_id = ?

                AND created_at >=
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL 12 MONTH
                    )

                GROUP BY
                    DATE_FORMAT(
                        created_at,
                        '%Y-%m'
                    )

                ORDER BY
                    month ASC
            `, [businessId])

        ]);


        // =====================================================
        // BASIC VALUES
        // =====================================================

        const today = todaySales[0] || {};
        const current = currentMonthSales[0] || {};
        const previous = previousMonthSales[0] || {};
        const products = productStats[0] || {};
        const customers = customerStats[0] || {};
        const suppliers = supplierStats[0] || {};
        const purchases = purchaseStats[0] || {};


        // =====================================================
        // SALES GROWTH
        // =====================================================

        const currentRevenue =
            Number(current.revenue || 0);

        const previousRevenue =
            Number(previous.revenue || 0);

        let salesGrowth = 0;

        if (previousRevenue > 0) {

            salesGrowth =
                (
                    (currentRevenue - previousRevenue) /
                    previousRevenue
                ) * 100;

        } else if (currentRevenue > 0) {

            salesGrowth = 100;

        }


        // =====================================================
        // ORDER GROWTH
        // =====================================================

        const currentOrders =
            Number(current.orders || 0);

        const previousOrders =
            Number(previous.orders || 0);

        let orderGrowth = 0;

        if (previousOrders > 0) {

            orderGrowth =
                (
                    (currentOrders - previousOrders) /
                    previousOrders
                ) * 100;

        } else if (currentOrders > 0) {

            orderGrowth = 100;

        }


        // =====================================================
        // INVENTORY VALUES
        // =====================================================

        const inventoryPurchaseValue =
            Number(
                products.inventory_purchase_value || 0
            );

        const inventorySellingValue =
            Number(
                products.inventory_selling_value || 0
            );

        const inventoryPotentialProfit =
            inventorySellingValue -
            inventoryPurchaseValue;


        let inventoryMargin = 0;

        if (inventorySellingValue > 0) {

            inventoryMargin =
                (
                    inventoryPotentialProfit /
                    inventorySellingValue
                ) * 100;

        }


        // =====================================================
        // PRODUCT ANALYSIS
        // =====================================================

        const [allProducts] = await db.query(`
            SELECT

                id,
                product_name,
                category,
                purchase_price,
                selling_price,
                stock,
                min_stock,
                tax,
                status,
                expiry_date

            FROM products

            WHERE business_id = ?
        `, [businessId]);


        const productSalesMap = {};

        for (const item of productSales) {

            productSalesMap[item.product_id] = {

                units_sold:
                    Number(item.units_sold || 0),

                revenue:
                    Number(item.revenue || 0)

            };

        }


        const productAnalysis =
            allProducts.map(product => {

                const purchasePrice =
                    Number(
                        product.purchase_price || 0
                    );

                const sellingPrice =
                    Number(
                        product.selling_price || 0
                    );

                const stock =
                    Number(
                        product.stock || 0
                    );

                const minStock =
                    Number(
                        product.min_stock || 0
                    );


                const profitPerUnit =
                    sellingPrice -
                    purchasePrice;


                let marginPercent = 0;

                if (sellingPrice > 0) {

                    marginPercent =
                        (
                            profitPerUnit /
                            sellingPrice
                        ) * 100;

                }


                const sales =
                    productSalesMap[product.id] || {};


                return {

                    id:
                        product.id,

                    product_name:
                        product.product_name,

                    category:
                        product.category,

                    purchase_price:
                        purchasePrice,

                    selling_price:
                        sellingPrice,

                    profit_per_unit:
                        Number(
                            profitPerUnit.toFixed(2)
                        ),

                    margin_percent:
                        Number(
                            marginPercent.toFixed(2)
                        ),

                    stock:
                        stock,

                    min_stock:
                        minStock,

                    stock_value:
                        Number(
                            (
                                stock *
                                purchasePrice
                            ).toFixed(2)
                        ),

                    selling_value:
                        Number(
                            (
                                stock *
                                sellingPrice
                            ).toFixed(2)
                        ),

                    potential_profit:
                        Number(
                            (
                                stock *
                                profitPerUnit
                            ).toFixed(2)
                        ),

                    units_sold_30_days:
                        sales.units_sold || 0,

                    revenue_30_days:
                        Number(
                            sales.revenue || 0
                        ),

                    stock_status:
                        stock <= 0
                            ? "out_of_stock"
                            : stock <= minStock
                                ? "low_stock"
                                : "normal",

                    status:
                        product.status,

                    expiry_date:
                        product.expiry_date

                };

            });


        // =====================================================
        // TOP SELLING PRODUCTS
        // =====================================================

        const topSellingProducts =
            [...productAnalysis]
                .filter(
                    product =>
                        product.units_sold_30_days > 0
                )
                .sort(
                    (a, b) =>
                        b.units_sold_30_days -
                        a.units_sold_30_days
                )
                .slice(0, 20);


        // =====================================================
        // HIGH MARGIN PRODUCTS
        // =====================================================

        const highMarginProducts =
            [...productAnalysis]
                .filter(
                    product =>
                        product.selling_price > 0
                )
                .sort(
                    (a, b) =>
                        b.margin_percent -
                        a.margin_percent
                )
                .slice(0, 20);


        // =====================================================
        // LOW MARGIN PRODUCTS
        // =====================================================

        const lowMarginProducts =
            [...productAnalysis]
                .filter(
                    product =>
                        product.selling_price > 0
                )
                .sort(
                    (a, b) =>
                        a.margin_percent -
                        b.margin_percent
                )
                .slice(0, 20);


        // =====================================================
        // DEAD STOCK
        // =====================================================
        // Stock exists but product has not sold
        // during the last 30 days.

        const deadStockProducts =
            productAnalysis
                .filter(
                    product =>
                        product.stock > 0 &&
                        product.units_sold_30_days === 0 &&
                        product.status === "active"
                )
                .sort(
                    (a, b) =>
                        b.stock_value -
                        a.stock_value
                )
                .slice(0, 50);


        // =====================================================
        // OVERSTOCKED PRODUCTS
        // =====================================================

        const overstockedProducts =
            productAnalysis
                .filter(
                    product =>
                        product.stock >
                            product.min_stock * 3 &&
                        product.units_sold_30_days <= 5 &&
                        product.status === "active"
                )
                .sort(
                    (a, b) =>
                        b.stock_value -
                        a.stock_value
                )
                .slice(0, 50);


        // =====================================================
        // OUT OF STOCK PRODUCTS
        // =====================================================

        const outOfStockProducts =
            productAnalysis
                .filter(
                    product =>
                        product.stock <= 0 &&
                        product.status === "active"
                );


        // =====================================================
        // RETURN COMPLETE ANALYTICS
        // =====================================================

        return {

            // =================================================
            // BUSINESS
            // =================================================

            business: {

                business_id:
                    Number(businessId),

                generated_at:
                    new Date().toISOString()

            },


            // =================================================
            // SALES
            // =================================================

            sales: {

                today: {

                    orders:
                        Number(
                            today.orders || 0
                        ),

                    revenue:
                        Number(
                            Number(
                                today.revenue || 0
                            ).toFixed(2)
                        ),

                    discount:
                        Number(
                            Number(
                                today.discount || 0
                            ).toFixed(2)
                        ),

                    tax:
                        Number(
                            Number(
                                today.tax || 0
                            ).toFixed(2)
                        ),

                    average_order_value:
                        Number(
                            Number(
                                today.average_order_value || 0
                            ).toFixed(2)
                        )

                },


                current_month: {

                    orders:
                        currentOrders,

                    revenue:
                        Number(
                            currentRevenue.toFixed(2)
                        ),

                    discount:
                        Number(
                            Number(
                                current.discount || 0
                            ).toFixed(2)
                        ),

                    tax:
                        Number(
                            Number(
                                current.tax || 0
                            ).toFixed(2)
                        ),

                    average_order_value:
                        Number(
                            Number(
                                current.average_order_value || 0
                            ).toFixed(2)
                        )

                },


                previous_month: {

                    orders:
                        previousOrders,

                    revenue:
                        Number(
                            previousRevenue.toFixed(2)
                        ),

                    discount:
                        Number(
                            Number(
                                previous.discount || 0
                            ).toFixed(2)
                        ),

                    tax:
                        Number(
                            Number(
                                previous.tax || 0
                            ).toFixed(2)
                        ),

                    average_order_value:
                        Number(
                            Number(
                                previous.average_order_value || 0
                            ).toFixed(2)
                        )

                },


                growth: {

                    revenue_percent:
                        Number(
                            salesGrowth.toFixed(2)
                        ),

                    orders_percent:
                        Number(
                            orderGrowth.toFixed(2)
                        )

                }

            },


            // =================================================
            // INVENTORY
            // =================================================

            inventory: {

                total_products:
                    Number(
                        products.total_products || 0
                    ),

                active_products:
                    Number(
                        products.active_products || 0
                    ),

                inactive_products:
                    Number(
                        products.inactive_products || 0
                    ),

                total_categories:
                    Number(
                        products.total_categories || 0
                    ),

                total_stock:
                    Number(
                        products.total_stock || 0
                    ),

                purchase_value:
                    Number(
                        inventoryPurchaseValue.toFixed(2)
                    ),

                selling_value:
                    Number(
                        inventorySellingValue.toFixed(2)
                    ),

                potential_profit:
                    Number(
                        inventoryPotentialProfit.toFixed(2)
                    ),

                potential_margin_percent:
                    Number(
                        inventoryMargin.toFixed(2)
                    ),

                low_stock_count:
                    lowStockProducts.length,

                out_of_stock_count:
                    outOfStockProducts.length,

                dead_stock_count:
                    deadStockProducts.length,

                low_stock_products:
                    lowStockProducts,

                out_of_stock_products:
                    outOfStockProducts,

                dead_stock_products:
                    deadStockProducts,

                overstocked_products:
                    overstockedProducts

            },


            // =================================================
            // PRODUCT INTELLIGENCE
            // =================================================

            products: {

                total:
                    productAnalysis.length,

                top_selling:
                    topSellingProducts,

                high_margin:
                    highMarginProducts,

                low_margin:
                    lowMarginProducts,

                all:
                    productAnalysis

            },


            // =================================================
            // CUSTOMERS
            // =================================================

            customers: {

                total:
                    Number(
                        customers.total_customers || 0
                    ),

                total_orders:
                    Number(
                        customers.total_orders || 0
                    ),

                total_spent:
                    Number(
                        Number(
                            customers.total_spent || 0
                        ).toFixed(2)
                    ),

                average_customer_value:
                    Number(
                        Number(
                            customers.average_customer_value || 0
                        ).toFixed(2)
                    ),

                inactive_60_days:
                    Number(
                        inactiveCustomers[0]?.total || 0
                    ),

                top_customers:
                    topCustomers

            },


            // =================================================
            // SUPPLIERS
            // =================================================

            suppliers: {

                total:
                    Number(
                        suppliers.total_suppliers || 0
                    ),

                active:
                    Number(
                        suppliers.active_suppliers || 0
                    ),

                inactive:
                    Number(
                        suppliers.inactive_suppliers || 0
                    )

            },


            // =================================================
            // PURCHASES
            // =================================================

            purchases: {

                total:
                    Number(
                        purchases.total_purchases || 0
                    ),

                total_value:
                    Number(
                        Number(
                            purchases.total_purchase_value || 0
                        ).toFixed(2)
                    ),

                total_paid:
                    Number(
                        Number(
                            purchases.total_paid || 0
                        ).toFixed(2)
                    ),

                total_due:
                    Number(
                        Number(
                            purchases.total_due || 0
                        ).toFixed(2)
                    ),

                average_purchase_value:
                    Number(
                        Number(
                            purchases.average_purchase_value || 0
                        ).toFixed(2)
                    ),

                monthly:
                    monthlyPurchases.map(item => ({

                        month:
                            item.month,

                        purchases:
                            Number(
                                item.purchases || 0
                            ),

                        amount:
                            Number(
                                Number(
                                    item.amount || 0
                                ).toFixed(2)
                            ),

                        paid:
                            Number(
                                Number(
                                    item.paid || 0
                                ).toFixed(2)
                            ),

                        due:
                            Number(
                                Number(
                                    item.due || 0
                                ).toFixed(2)
                            )

                    }))

            },


            // =================================================
            // CATEGORY PERFORMANCE
            // =================================================

            categories:
                categorySales.map(item => ({

                    category:
                        item.category,

                    units_sold:
                        Number(
                            item.units_sold || 0
                        ),

                    revenue:
                        Number(
                            Number(
                                item.revenue || 0
                            ).toFixed(2)
                        )

                })),


            // =================================================
            // PAYMENT PERFORMANCE
            // =================================================

            payments:
                paymentMethods.map(item => ({

                    method:
                        item.payment_method,

                    orders:
                        Number(
                            item.orders || 0
                        ),

                    revenue:
                        Number(
                            Number(
                                item.revenue || 0
                            ).toFixed(2)
                        )

                })),


            // =================================================
            // DAILY SALES
            // =================================================

            daily_sales:
                dailySales.map(item => ({

                    date:
                        item.date,

                    orders:
                        Number(
                            item.orders || 0
                        ),

                    revenue:
                        Number(
                            Number(
                                item.revenue || 0
                            ).toFixed(2)
                        ),

                    discount:
                        Number(
                            Number(
                                item.discount || 0
                            ).toFixed(2)
                        ),

                    tax:
                        Number(
                            Number(
                                item.tax || 0
                            ).toFixed(2)
                        )

                }))

        };

    } catch (error) {

        console.error(
            "Business Analytics Engine Error:",
            error
        );

        throw error;
    }
};