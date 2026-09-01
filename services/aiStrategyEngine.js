const {
    getBusinessAnalytics
} = require("./businessAnalytics");

// ============================================================
// AI BUSINESS STRATEGY ENGINE
// ============================================================
// Step 2
//
// businessAnalytics.js
//      ↓
// aiStrategyEngine.js
//      ↓
// Business strategy / risks / opportunities / actions
//
// This engine uses REAL business analytics.
// It does not accept business_id from the frontend.
// ============================================================


// ============================================================
// HELPERS
// ============================================================

const number = (value) => {

    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : 0;
};


const money = (value) => {

    return Number(
        number(value).toFixed(2)
    );

};


const percent = (value) => {

    return Number(
        number(value).toFixed(2)
    );

};


const array = (value) => {

    return Array.isArray(value)
        ? value
        : [];

};


const productName = (product) => {

    return (
        product?.product_name ||
        product?.name ||
        "Unknown Product"
    );

};


// ============================================================
// BUSINESS HEALTH SCORE
// ============================================================

function calculateHealth(analytics) {

    const salesGrowth =
        number(
            analytics?.sales?.growth?.revenue_percent
        );

    const inventory =
        analytics?.inventory || {};

    const customers =
        analytics?.customers || {};

    const purchases =
        analytics?.purchases || {};


    const lowStock =
        number(
            inventory.low_stock_count
        );

    const outOfStock =
        number(
            inventory.out_of_stock_count
        );

    const deadStock =
        number(
            inventory.dead_stock_count
        );

    const overstock =
        number(
            inventory.overstocked_count
        );

    const inactiveCustomers =
        number(
            customers.inactive_60_days
        );

    const purchaseDue =
        number(
            purchases.total_due
        );


    let score = 70;


    // ========================================================
    // SALES
    // ========================================================

    if (salesGrowth >= 25) {

        score += 15;

    } else if (salesGrowth >= 10) {

        score += 10;

    } else if (salesGrowth >= 0) {

        score += 3;

    } else if (salesGrowth >= -10) {

        score -= 8;

    } else {

        score -= 15;

    }


    // ========================================================
    // INVENTORY
    // ========================================================

    score -= Math.min(
        outOfStock * 2,
        15
    );

    score -= Math.min(
        lowStock,
        10
    );

    score -= Math.min(
        deadStock,
        10
    );

    score -= Math.min(
        overstock,
        5
    );


    // ========================================================
    // CUSTOMERS
    // ========================================================

    if (inactiveCustomers > 50) {

        score -= 10;

    } else if (inactiveCustomers > 20) {

        score -= 6;

    } else if (inactiveCustomers > 5) {

        score -= 3;

    }


    // ========================================================
    // PURCHASE DUES
    // ========================================================

    if (purchaseDue > 100000) {

        score -= 8;

    } else if (purchaseDue > 50000) {

        score -= 5;

    } else if (purchaseDue > 25000) {

        score -= 2;

    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(score)
            )
        );


    let status = "stable";


    if (score >= 85) {

        status = "excellent";

    } else if (score >= 70) {

        status = "healthy";

    } else if (score >= 50) {

        status = "needs_attention";

    } else {

        status = "critical";

    }


    return {

        score,

        status,

        explanation:
            `Business health score is ${score}/100 based on sales growth, inventory risk, customer activity and purchase obligations.`

    };

}


// ============================================================
// SALES STRATEGY
// ============================================================

function buildSalesStrategy(analytics) {

    const sales =
        analytics?.sales || {};


    const current =
        sales.current_month || {};

    const previous =
        sales.previous_month || {};

    const growth =
        number(
            sales?.growth?.revenue_percent
        );


    const currentRevenue =
        number(
            current.revenue
        );

    const previousRevenue =
        number(
            previous.revenue
        );

    const currentOrders =
        number(
            current.orders
        );

    const averageOrder =
        number(
            current.average_order_value
        );


    const recommendations = [];

    const actions = [];


    // ========================================================
    // SALES GROWTH
    // ========================================================

    if (growth < -15) {

        recommendations.push(
            "Sales are declining significantly compared with the previous month."
        );

        actions.push(
            "Focus immediately on your best-selling products and existing customers."
        );

        actions.push(
            "Run targeted promotions instead of applying discounts to every product."
        );

    } else if (growth < 0) {

        recommendations.push(
            "Sales are declining compared with the previous month."
        );

        actions.push(
            "Review your top products, customer activity and pricing before increasing inventory."
        );

    } else if (growth < 5) {

        recommendations.push(
            "Sales are stable but growth is currently weak."
        );

        actions.push(
            "Increase repeat purchases and promote products that already have demand."
        );

    } else if (growth < 15) {

        recommendations.push(
            `Sales are growing ${percent(growth)}% compared with the previous month.`
        );

        actions.push(
            "Protect current growth by keeping popular products available."
        );

    } else {

        recommendations.push(
            `Sales are showing strong growth of ${percent(growth)}%.`
        );

        actions.push(
            "Increase availability of proven best sellers so growth is not limited by stock."
        );

    }


    // ========================================================
    // AVERAGE ORDER VALUE
    // ========================================================

    if (averageOrder > 0) {

        actions.push(
            `Increase the average order value of ₹${averageOrder.toLocaleString("en-IN")} through bundles, cross-selling and complementary products.`
        );

    }


    // ========================================================
    // ORDERS
    // ========================================================

    if (currentOrders === 0) {

        recommendations.push(
            "There are currently no recorded orders for the current month."
        );

    }


    return {

        current_month_revenue:
            money(currentRevenue),

        previous_month_revenue:
            money(previousRevenue),

        revenue_growth_percent:
            percent(growth),

        current_month_orders:
            currentOrders,

        average_order_value:
            money(averageOrder),

        recommendations,

        actions

    };

}


// ============================================================
// INVENTORY STRATEGY
// ============================================================

function buildInventoryStrategy(analytics) {

    const inventory =
        analytics?.inventory || {};


    const lowStock =
        array(
            inventory.low_stock_products
        );

    const outOfStock =
        array(
            inventory.out_of_stock_products
        );

    const deadStock =
        array(
            inventory.dead_stock_products
        );

    const overstocked =
        array(
            inventory.overstocked_products
        );


    const recommendations = [];

    const actions = [];


    // ========================================================
    // OUT OF STOCK
    // ========================================================

    if (outOfStock.length > 0) {

        recommendations.push(
            `${outOfStock.length} product(s) are currently out of stock.`
        );

        actions.push(
            "Prioritize replenishment of out-of-stock products that have recent sales."
        );

    }


    // ========================================================
    // LOW STOCK
    // ========================================================

    if (lowStock.length > 0) {

        recommendations.push(
            `${lowStock.length} product(s) are at or below the minimum stock level.`
        );

        actions.push(
            "Review low-stock products and reorder only where recent demand supports the purchase."
        );

    }


    // ========================================================
    // DEAD STOCK
    // ========================================================

    if (deadStock.length > 0) {

        recommendations.push(
            `${deadStock.length} product(s) have stock but no sales in the recent analysis period.`
        );

        actions.push(
            "Use bundles, offers or clearance pricing to convert dead stock into cash."
        );

    }


    // ========================================================
    // OVERSTOCK
    // ========================================================

    if (overstocked.length > 0) {

        recommendations.push(
            `${overstocked.length} product(s) appear overstocked.`
        );

        actions.push(
            "Reduce new purchases for slow-moving overstocked products."
        );

    }


    // ========================================================
    // NO MAJOR ISSUE
    // ========================================================

    if (
        lowStock.length === 0 &&
        outOfStock.length === 0 &&
        deadStock.length === 0 &&
        overstocked.length === 0
    ) {

        recommendations.push(
            "No major inventory warning was detected from the available data."
        );

    }


    return {

        total_products:
            number(
                inventory.total_products
            ),

        total_stock:
            number(
                inventory.total_stock
            ),

        purchase_value:
            money(
                inventory.purchase_value
            ),

        selling_value:
            money(
                inventory.selling_value
            ),

        potential_profit:
            money(
                inventory.potential_profit
            ),

        potential_margin_percent:
            percent(
                inventory.potential_margin_percent
            ),

        low_stock_count:
            lowStock.length,

        out_of_stock_count:
            outOfStock.length,

        dead_stock_count:
            deadStock.length,

        overstocked_count:
            overstocked.length,

        recommendations,

        actions,

        priority_products: {

            out_of_stock:
                outOfStock
                    .slice(0, 10)
                    .map(product => ({
                        id: product.id,
                        name: productName(product),
                        stock:
                            number(product.stock),
                        min_stock:
                            number(product.min_stock)
                    })),

            low_stock:
                lowStock
                    .slice(0, 10)
                    .map(product => ({
                        id: product.id,
                        name: productName(product),
                        stock:
                            number(product.stock),
                        min_stock:
                            number(product.min_stock)
                    })),

            dead_stock:
                deadStock
                    .slice(0, 10)
                    .map(product => ({
                        id: product.id,
                        name: productName(product),
                        stock:
                            number(product.stock)
                    }))

        }

    };

}


// ============================================================
// PRODUCT STRATEGY
// ============================================================

function buildProductStrategy(analytics) {

    const products =
        analytics?.products || {};


    const topSelling =
        array(
            products.top_selling
        );

    const highMargin =
        array(
            products.high_margin
        );

    const lowMargin =
        array(
            products.low_margin
        );


    const recommendations = [];


    // ========================================================
    // BEST SELLER
    // ========================================================

    if (topSelling.length > 0) {

        const product =
            topSelling[0];

        recommendations.push(
            `Protect ${productName(product)} because it is one of the strongest recent sellers.`
        );

    }


    // ========================================================
    // HIGH MARGIN
    // ========================================================

    if (highMargin.length > 0) {

        const product =
            highMargin[0];

        recommendations.push(
            `Promote ${productName(product)} because it has a strong product margin.`
        );

    }


    // ========================================================
    // LOW MARGIN
    // ========================================================

    if (lowMargin.length > 0) {

        const product =
            lowMargin[0];

        recommendations.push(
            `Review ${productName(product)} because its margin is comparatively low.`
        );

    }


    return {

        total_products:
            number(products.total),

        recommendations,

        top_selling:
            topSelling
                .slice(0, 10)
                .map(product => ({
                    id: product.id,

                    name:
                        productName(product),

                    units_sold_30_days:
                        number(
                            product.units_sold_30_days
                        ),

                    revenue_30_days:
                        money(
                            product.revenue_30_days
                        ),

                    margin_percent:
                        percent(
                            product.margin_percent
                        )
                })),

        high_margin:
            highMargin
                .slice(0, 10)
                .map(product => ({
                    id: product.id,

                    name:
                        productName(product),

                    margin_percent:
                        percent(
                            product.margin_percent
                        ),

                    profit_per_unit:
                        money(
                            product.profit_per_unit
                        )
                })),

        low_margin:
            lowMargin
                .slice(0, 10)
                .map(product => ({
                    id: product.id,

                    name:
                        productName(product),

                    margin_percent:
                        percent(
                            product.margin_percent
                        ),

                    profit_per_unit:
                        money(
                            product.profit_per_unit
                        )
                }))

    };

}


// ============================================================
// CUSTOMER STRATEGY
// ============================================================

function buildCustomerStrategy(analytics) {

    const customers =
        analytics?.customers || {};


    const total =
        number(
            customers.total
        );

    const inactive =
        number(
            customers.inactive_60_days
        );

    const totalSpent =
        number(
            customers.total_spent
        );

    const averageValue =
        number(
            customers.average_customer_value
        );


    const recommendations = [];

    const actions = [];


    // ========================================================
    // INACTIVE CUSTOMER RATE
    // ========================================================

    const inactiveRate =
        total > 0
            ? (inactive / total) * 100
            : 0;


    if (inactive > 0) {

        recommendations.push(
            `${inactive} customer(s) have not purchased for 60+ days.`
        );

        actions.push(
            "Create a customer win-back campaign for inactive customers."
        );

    }


    if (inactiveRate > 30) {

        recommendations.push(
            `${percent(inactiveRate)}% of customers are currently inactive for 60+ days.`
        );

        actions.push(
            "Improve repeat-purchase communication and customer follow-up."
        );

    }


    if (averageValue > 0) {

        actions.push(
            `Increase customer value above the current average of ₹${averageValue.toLocaleString("en-IN")} using bundles and repeat-purchase offers.`
        );

    }


    if (recommendations.length === 0) {

        recommendations.push(
            "No major customer inactivity warning was detected."
        );

    }


    return {

        total_customers:
            total,

        total_orders:
            number(
                customers.total_orders
            ),

        total_spent:
            money(totalSpent),

        average_customer_value:
            money(averageValue),

        inactive_60_days:
            inactive,

        inactive_rate_percent:
            percent(inactiveRate),

        recommendations,

        actions,

        top_customers:
            array(
                customers.top_customers
            )
                .slice(0, 10)
                .map(customer => ({
                    id: customer.id,

                    name:
                        customer.customer_name,

                    phone:
                        customer.customer_phone,

                    total_orders:
                        number(
                            customer.total_orders
                        ),

                    total_spent:
                        money(
                            customer.total_spent
                        ),

                    last_purchase:
                        customer.last_purchase,

                    status:
                        customer.status
                }))

    };

}


// ============================================================
// PURCHASE STRATEGY
// ============================================================

function buildPurchaseStrategy(analytics) {

    const purchases =
        analytics?.purchases || {};


    const totalValue =
        number(
            purchases.total_value
        );

    const paid =
        number(
            purchases.total_paid
        );

    const due =
        number(
            purchases.total_due
        );


    const recommendations = [];

    const actions = [];


    if (due > 0) {

        recommendations.push(
            `There is ₹${due.toLocaleString("en-IN")} outstanding on purchases.`
        );

        actions.push(
            "Review supplier balances and plan payments before increasing non-essential purchases."
        );

    }


    if (totalValue > 0) {

        const dueRate =
            (due / totalValue) * 100;


        if (dueRate > 30) {

            recommendations.push(
                `Outstanding purchase dues represent ${percent(dueRate)}% of total purchase value.`
            );

            actions.push(
                "Be conservative with new purchases until supplier obligations and cash flow are reviewed."
            );

        }

    }


    if (recommendations.length === 0) {

        recommendations.push(
            "No significant purchase obligation warning was detected."
        );

    }


    return {

        total_purchases:
            number(
                purchases.total
            ),

        total_value:
            money(totalValue),

        total_paid:
            money(paid),

        total_due:
            money(due),

        average_purchase_value:
            money(
                purchases.average_purchase_value
            ),

        recommendations,

        actions,

        monthly:
            array(
                purchases.monthly
            )

    };

}


// ============================================================
// CATEGORY STRATEGY
// ============================================================

function buildCategoryStrategy(analytics) {

    const categories =
        array(
            analytics?.categories
        );


    if (categories.length === 0) {

        return {

            recommendations: [
                "Not enough category sales data is available yet."
            ],

            top_categories: []

        };

    }


    const top =
        categories[0];


    return {

        recommendations: [

            `${top.category || "Top category"} is currently the strongest category by revenue in the available analysis period.`,

            "Use strong categories to attract customers while improving the visibility of profitable products."

        ],

        top_categories:
            categories
                .slice(0, 10)
                .map(category => ({
                    category:
                        category.category,

                    units_sold:
                        number(
                            category.units_sold
                        ),

                    revenue:
                        money(
                            category.revenue
                        )
                }))

    };

}


// ============================================================
// PAYMENT STRATEGY
// ============================================================

function buildPaymentStrategy(analytics) {

    const payments =
        array(
            analytics?.payments
        );


    if (payments.length === 0) {

        return {

            recommendations: [
                "Payment-method data is not available yet."
            ],

            methods: []

        };

    }


    const top =
        [...payments]
            .sort(
                (a, b) =>
                    number(b.revenue) -
                    number(a.revenue)
            )[0];


    return {

        recommendations: [

            `${top.payment_method || "Payment method"} is currently generating the highest recorded payment revenue.`,

            "Keep popular payment methods available and use payment data to understand customer buying behavior."

        ],

        methods:
            payments
                .map(payment => ({
                    payment_method:
                        payment.payment_method,

                    orders:
                        number(
                            payment.orders
                        ),

                    revenue:
                        money(
                            payment.revenue
                        )
                }))

    };

}


// ============================================================
// RISK ENGINE
// ============================================================

function buildRisks(analytics) {

    const risks = [];


    const salesGrowth =
        number(
            analytics?.sales?.growth?.revenue_percent
        );

    const inventory =
        analytics?.inventory || {};

    const customers =
        analytics?.customers || {};

    const purchases =
        analytics?.purchases || {};


    // ========================================================
    // SALES
    // ========================================================

    if (salesGrowth < -15) {

        risks.push({

            level: "HIGH",

            type: "sales_decline",

            message:
                `Monthly revenue is down ${Math.abs(percent(salesGrowth))}%.`

        });

    } else if (salesGrowth < 0) {

        risks.push({

            level: "MEDIUM",

            type: "sales_decline",

            message:
                `Monthly revenue is down ${Math.abs(percent(salesGrowth))}%.`

        });

    }


    // ========================================================
    // OUT OF STOCK
    // ========================================================

    if (
        number(
            inventory.out_of_stock_count
        ) > 0
    ) {

        risks.push({

            level: "HIGH",

            type: "out_of_stock",

            message:
                `${number(inventory.out_of_stock_count)} product(s) are out of stock.`

        });

    }


    // ========================================================
    // LOW STOCK
    // ========================================================

    if (
        number(
            inventory.low_stock_count
        ) > 0
    ) {

        risks.push({

            level: "MEDIUM",

            type: "low_stock",

            message:
                `${number(inventory.low_stock_count)} product(s) are below minimum stock.`

        });

    }


    // ========================================================
    // DEAD STOCK
    // ========================================================

    if (
        number(
            inventory.dead_stock_count
        ) > 0
    ) {

        risks.push({

            level: "MEDIUM",

            type: "dead_stock",

            message:
                `${number(inventory.dead_stock_count)} product(s) have no recent sales.`

        });

    }


    // ========================================================
    // CUSTOMERS
    // ========================================================

    if (
        number(
            customers.inactive_60_days
        ) > 0
    ) {

        risks.push({

            level: "MEDIUM",

            type: "inactive_customers",

            message:
                `${number(customers.inactive_60_days)} customer(s) are inactive for 60+ days.`

        });

    }


    // ========================================================
    // PURCHASE DUES
    // ========================================================

    if (
        number(
            purchases.total_due
        ) > 0
    ) {

        risks.push({

            level: "MEDIUM",

            type: "purchase_due",

            message:
                `₹${number(purchases.total_due).toLocaleString("en-IN")} is currently due on purchases.`

        });

    }


    return risks;

}


// ============================================================
// OPPORTUNITY ENGINE
// ============================================================

function buildOpportunities(analytics) {

    const opportunities = [];


    const topSelling =
        array(
            analytics?.products?.top_selling
        );

    const highMargin =
        array(
            analytics?.products?.high_margin
        );

    const deadStock =
        array(
            analytics?.inventory?.dead_stock_products
        );

    const inactiveCustomers =
        number(
            analytics?.customers?.inactive_60_days
        );


    // ========================================================
    // BEST SELLER
    // ========================================================

    if (topSelling.length > 0) {

        opportunities.push({

            priority: "HIGH",

            type: "best_seller",

            title:
                "Best-seller growth opportunity",

            message:
                `Increase visibility and stock availability for ${productName(topSelling[0])}.`

        });

    }


    // ========================================================
    // HIGH MARGIN
    // ========================================================

    if (highMargin.length > 0) {

        opportunities.push({

            priority: "HIGH",

            type: "high_margin",

            title:
                "Profit opportunity",

            message:
                `Promote ${productName(highMargin[0])} to improve profit per order.`

        });

    }


    // ========================================================
    // CUSTOMER REACTIVATION
    // ========================================================

    if (inactiveCustomers > 0) {

        opportunities.push({

            priority: "MEDIUM",

            type: "customer_reactivation",

            title:
                "Customer reactivation",

            message:
                `There are ${inactiveCustomers} inactive customers who can be targeted for repeat sales.`

        });

    }


    // ========================================================
    // DEAD STOCK
    // ========================================================

    if (deadStock.length > 0) {

        opportunities.push({

            priority: "MEDIUM",

            type: "dead_stock_recovery",

            title:
                "Dead-stock recovery",

            message:
                "Convert slow-moving stock into cash using bundles, clearance or targeted offers."

        });

    }


    return opportunities;

}


// ============================================================
// ACTION PLAN
// ============================================================

function buildActionPlan(analytics) {

    const actions = [];


    const inventory =
        analytics?.inventory || {};

    const sales =
        analytics?.sales || {};

    const customers =
        analytics?.customers || {};

    const purchases =
        analytics?.purchases || {};


    // ========================================================
    // TODAY
    // ========================================================

    if (
        number(
            inventory.out_of_stock_count
        ) > 0
    ) {

        actions.push({

            priority: 1,

            timeframe: "Today",

            action:
                "Review and reorder important out-of-stock products."

        });

    }


    if (
        number(
            inventory.low_stock_count
        ) > 0
    ) {

        actions.push({

            priority: 2,

            timeframe: "Today",

            action:
                "Check low-stock products against recent demand before purchasing."

        });

    }


    // ========================================================
    // THIS WEEK
    // ========================================================

    if (
        number(
            sales.growth?.revenue_percent
        ) < 0
    ) {

        actions.push({

            priority: 3,

            timeframe: "This week",

            action:
                "Create a focused sales campaign around top-selling and high-margin products."

        });

    }


    if (
        number(
            customers.inactive_60_days
        ) > 0
    ) {

        actions.push({

            priority: 4,

            timeframe: "This week",

            action:
                "Contact inactive customers with a targeted win-back offer."

        });

    }


    if (
        number(
            inventory.dead_stock_count
        ) > 0
    ) {

        actions.push({

            priority: 5,

            timeframe: "This week",

            action:
                "Create a promotion or clearance plan for dead stock."

        });

    }


    if (
        number(
            purchases.total_due
        ) > 0
    ) {

        actions.push({

            priority: 6,

            timeframe: "This week",

            action:
                "Review supplier dues and plan payments alongside upcoming purchases."

        });

    }


    // ========================================================
    // DEFAULT
    // ========================================================

    if (actions.length === 0) {

        actions.push({

            priority: 1,

            timeframe: "This week",

            action:
                "Continue monitoring sales, inventory, customer activity and product margins."

        });

    }


    return actions;

}


// ============================================================
// EXECUTIVE SUMMARY
// ============================================================

function buildExecutiveSummary(analytics, health) {

    const sales =
        analytics?.sales || {};

    const inventory =
        analytics?.inventory || {};

    const customers =
        analytics?.customers || {};

    const purchases =
        analytics?.purchases || {};


    return {

        health_score:
            health.score,

        health_status:
            health.status,

        monthly_revenue:
            money(
                sales?.current_month?.revenue
            ),

        previous_month_revenue:
            money(
                sales?.previous_month?.revenue
            ),

        sales_growth_percent:
            percent(
                sales?.growth?.revenue_percent
            ),

        monthly_orders:
            number(
                sales?.current_month?.orders
            ),

        inventory_potential_profit:
            money(
                inventory.potential_profit
            ),

        low_stock_products:
            number(
                inventory.low_stock_count
            ),

        out_of_stock_products:
            number(
                inventory.out_of_stock_count
            ),

        dead_stock_products:
            number(
                inventory.dead_stock_count
            ),

        inactive_customers:
            number(
                customers.inactive_60_days
            ),

        purchase_due:
            money(
                purchases.total_due
            )

    };

}


// ============================================================
// MAIN AI STRATEGY ENGINE
// ============================================================

async function generateBusinessStrategy(
    businessId
) {

    if (!businessId) {

        throw new Error(
            "Business ID is required"
        );

    }


    // ========================================================
    // STEP 1
    // GET REAL BUSINESS ANALYTICS
    // ========================================================

    const analytics =
        await getBusinessAnalytics(
            Number(businessId)
        );


    // ========================================================
    // STEP 2
    // BUILD INTELLIGENCE
    // ========================================================

    const health =
        calculateHealth(
            analytics
        );


    const sales =
        buildSalesStrategy(
            analytics
        );


    const inventory =
        buildInventoryStrategy(
            analytics
        );


    const products =
        buildProductStrategy(
            analytics
        );


    const customers =
        buildCustomerStrategy(
            analytics
        );


    const purchases =
        buildPurchaseStrategy(
            analytics
        );


    const categories =
        buildCategoryStrategy(
            analytics
        );


    const payments =
        buildPaymentStrategy(
            analytics
        );


    const risks =
        buildRisks(
            analytics
        );


    const opportunities =
        buildOpportunities(
            analytics
        );


    const actionPlan =
        buildActionPlan(
            analytics
        );


    const executiveSummary =
        buildExecutiveSummary(
            analytics,
            health
        );


    // ========================================================
    // FINAL RESPONSE
    // ========================================================

    return {

        business:
            analytics.business || {
                business_id:
                    Number(businessId)
            },


        generated_at:
            new Date().toISOString(),


        engine: {

            name:
                "AI Business Strategy Engine",

            version:
                "1.0.0",

            stage:
                "business_strategy",

            data_source:
                "businessAnalytics"

        },


        health,


        executive_summary:
            executiveSummary,


        sales_strategy:
            sales,


        inventory_strategy:
            inventory,


        product_strategy:
            products,


        customer_strategy:
            customers,


        purchase_strategy:
            purchases,


        category_strategy:
            categories,


        payment_strategy:
            payments,


        risks,


        opportunities,


        action_plan:
            actionPlan

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    generateBusinessStrategy

};