const db = require("../config/db");

// =====================================================
// HELPERS
// =====================================================

function buildDateCondition(alias, from, to) {
    if (!from || !to) {
        return {
            sql: "",
            params: []
        };
    }

    return {
        sql: `
            AND ${alias}.created_at >= ?
            AND ${alias}.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        params: [from, to]
    };
}


// =====================================================
// REPORT SUMMARY
// =====================================================

exports.getReportSummary = async (req, res) => {
    try {
        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

        const { from, to } = req.query;

        const salesDate = buildDateCondition(
            "s",
            from,
            to
        );

        const purchaseDate = buildDateCondition(
            "p",
            from,
            to
        );


        // =============================================
        // SALES
        // =============================================

        const [[sales]] = await db.query(
            `
            SELECT
                COUNT(*) AS total_bills,

                IFNULL(SUM(subtotal), 0) AS subtotal,

                IFNULL(SUM(discount), 0) AS discount,

                IFNULL(SUM(tax), 0) AS tax,

                IFNULL(SUM(total_amount), 0) AS total_sales

            FROM sales s

            WHERE s.business_id = ?

            ${salesDate.sql}
            `,
            [
                businessId,
                ...salesDate.params
            ]
        );


        // =============================================
        // PURCHASES
        // =============================================

        const [[purchases]] = await db.query(
            `
            SELECT
                COUNT(*) AS total_purchases,

                IFNULL(SUM(total_amount), 0)
                    AS purchase_amount,

                IFNULL(SUM(paid_amount), 0)
                    AS paid_amount,

                IFNULL(SUM(due_amount), 0)
                    AS due_amount

            FROM purchases p

            WHERE p.business_id = ?

            ${purchaseDate.sql}
            `,
            [
                businessId,
                ...purchaseDate.params
            ]
        );


        res.json({
            success: true,

            data: {
                sales: {
                    total_bills:
                        Number(sales.total_bills || 0),

                    subtotal:
                        Number(sales.subtotal || 0),

                    discount:
                        Number(sales.discount || 0),

                    tax:
                        Number(sales.tax || 0),

                    total_sales:
                        Number(sales.total_sales || 0)
                },

                purchases: {
                    total_purchases:
                        Number(
                            purchases.total_purchases || 0
                        ),

                    purchase_amount:
                        Number(
                            purchases.purchase_amount || 0
                        ),

                    paid_amount:
                        Number(
                            purchases.paid_amount || 0
                        ),

                    due_amount:
                        Number(
                            purchases.due_amount || 0
                        )
                }
            }
        });

    } catch (err) {

        console.error(
            "Report Summary Error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to generate report summary"
        });
    }
};


// =====================================================
// SALES REPORT
// =====================================================

exports.getSalesReport = async (req, res) => {

    try {

        const businessId = req.businessId;

        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business ID is required"
            });
        }

        const { from, to } = req.query;


        // =============================================
        // SALES DATA
        // =============================================

        let query = `
            SELECT

                s.id,

                s.invoice_no,

                s.customer_name,

                s.customer_phone,

                s.subtotal,

                s.discount,

                s.gst_percent,

                s.cgst,

                s.sgst,

                s.tax,

                s.total_amount,

                s.payment_method,

                s.payment_status,

                s.created_at

            FROM sales s

            WHERE s.business_id = ?
        `;


        const params = [businessId];


        if (from && to) {

            query += `
                AND s.created_at >= ?
                AND s.created_at <
                    DATE_ADD(?, INTERVAL 1 DAY)
            `;

            params.push(from, to);
        }


        query += `
            ORDER BY s.created_at DESC
        `;


        const [rows] = await db.query(
            query,
            params
        );


        // =============================================
        // PAYMENT SUMMARY
        // =============================================

        let paymentQuery = `
            SELECT

                payment_method,

                COUNT(*) AS bills,

                IFNULL(
                    SUM(total_amount),
                    0
                ) AS amount

            FROM sales

            WHERE business_id = ?
        `;


        const paymentParams = [
            businessId
        ];


        if (from && to) {

            paymentQuery += `
                AND created_at >= ?
                AND created_at <
                    DATE_ADD(?, INTERVAL 1 DAY)
            `;

            paymentParams.push(
                from,
                to
            );
        }


        paymentQuery += `
            GROUP BY payment_method

            ORDER BY amount DESC
        `;


        const [paymentSummary] =
            await db.query(
                paymentQuery,
                paymentParams
            );


        // =============================================
        // TOTALS
        // =============================================

        const totalBills =
            rows.length;


        const totalSales =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.total_amount || 0
                    ),
                0
            );


        const totalDiscount =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.discount || 0
                    ),
                0
            );


        const totalTax =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.tax || 0
                    ),
                0
            );


        const totalSubtotal =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.subtotal || 0
                    ),
                0
            );


        res.json({

            success: true,

            summary: {

                total_bills:
                    totalBills,

                subtotal:
                    Number(
                        totalSubtotal.toFixed(2)
                    ),

                total_sales:
                    Number(
                        totalSales.toFixed(2)
                    ),

                total_discount:
                    Number(
                        totalDiscount.toFixed(2)
                    ),

                total_tax:
                    Number(
                        totalTax.toFixed(2)
                    )
            },

            payment_summary:
                paymentSummary,

            data:
                rows
        });

    } catch (err) {

        console.error(
            "Sales Report Error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to generate sales report"
        });
    }
};


// =====================================================
// PURCHASE REPORT
// =====================================================

exports.getPurchaseReport = async (
    req,
    res
) => {

    try {

        const businessId =
            req.businessId;


        if (!businessId) {

            return res.status(400).json({
                success: false,
                message:
                    "Business ID is required"
            });
        }


        const { from, to } =
            req.query;


        let query = `

            SELECT

                p.id,

                p.invoice_no,

                s.supplier_name,

                p.subtotal,

                p.discount,

                p.tax,

                p.total_amount,

                p.payment_method,

                p.payment_status,

                p.paid_amount,

                p.due_amount,

                p.notes,

                p.created_at

            FROM purchases p

            LEFT JOIN suppliers s

                ON p.supplier_id = s.id

                AND s.business_id =
                    p.business_id

            WHERE p.business_id = ?

        `;


        const params = [
            businessId
        ];


        if (from && to) {

            query += `

                AND p.created_at >= ?

                AND p.created_at <
                    DATE_ADD(
                        ?,
                        INTERVAL 1 DAY
                    )

            `;

            params.push(
                from,
                to
            );
        }


        query += `

            ORDER BY
                p.created_at DESC

        `;


        const [rows] =
            await db.query(
                query,
                params
            );


        // =============================================
        // TOTALS
        // =============================================

        const totalPurchases =
            rows.length;


        const purchaseAmount =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.total_amount || 0
                    ),
                0
            );


        const paidAmount =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.paid_amount || 0
                    ),
                0
            );


        const dueAmount =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.due_amount || 0
                    ),
                0
            );


        const purchaseSubtotal =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.subtotal || 0
                    ),
                0
            );


        const totalDiscount =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.discount || 0
                    ),
                0
            );


        const totalTax =
            rows.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.tax || 0
                    ),
                0
            );


        res.json({

            success: true,

            summary: {

                total_purchases:
                    totalPurchases,

                subtotal:
                    Number(
                        purchaseSubtotal.toFixed(2)
                    ),

                purchase_amount:
                    Number(
                        purchaseAmount.toFixed(2)
                    ),

                total_discount:
                    Number(
                        totalDiscount.toFixed(2)
                    ),

                total_tax:
                    Number(
                        totalTax.toFixed(2)
                    ),

                paid_amount:
                    Number(
                        paidAmount.toFixed(2)
                    ),

                due_amount:
                    Number(
                        dueAmount.toFixed(2)
                    )
            },

            data:
                rows
        });

    } catch (err) {

        console.error(
            "Purchase Report Error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to generate purchase report"
        });
    }
};


// =====================================================
// PROFIT REPORT
// =====================================================

exports.getProfitReport = async (
    req,
    res
) => {

    try {

        const businessId =
            req.businessId;


        if (!businessId) {

            return res.status(400).json({
                success: false,
                message:
                    "Business ID is required"
            });
        }


        const { from, to } =
            req.query;


        /*
        =================================================
        IMPORTANT PROFIT LOGIC

        sale_items.total
            = item selling amount + item tax

        sale_items.tax
            = item tax

        Therefore:

        itemNet =
            sale_items.total
            - sale_items.tax

        Then invoice discount is allocated
        proportionally across items.

        This means:

        NET SALES
        =
        item net sales
        - allocated invoice discount

        PROFIT
        =
        NET SALES
        - PURCHASE COST

        GST is NOT treated as profit.
        =================================================
        */


        let query = `

            SELECT

                si.product_id,

                si.product_name,

                SUM(
                    si.quantity
                ) AS quantity_sold,


                SUM(

                    (
                        si.total
                        - si.tax
                    )

                    -

                    CASE

                        WHEN
                            s.subtotal > 0

                        THEN

                            s.discount *

                            (
                                (
                                    si.total
                                    - si.tax
                                )

                                /

                                s.subtotal
                            )

                        ELSE 0

                    END

                ) AS sales_value,


                SUM(

                    si.quantity *
                    p.purchase_price

                ) AS purchase_value


            FROM sale_items si


            INNER JOIN sales s

                ON si.sale_id = s.id

                AND s.business_id = ?


            INNER JOIN products p

                ON si.product_id = p.id

                AND p.business_id = ?


            WHERE 1 = 1

        `;


        const params = [

            businessId,

            businessId

        ];


        if (from && to) {

            query += `

                AND s.created_at >= ?

                AND s.created_at <
                    DATE_ADD(
                        ?,
                        INTERVAL 1 DAY
                    )

            `;

            params.push(
                from,
                to
            );
        }


        query += `

            GROUP BY

                si.product_id,

                si.product_name

            ORDER BY
                sales_value DESC

        `;


        const [rows] =
            await db.query(
                query,
                params
            );


        // =============================================
        // CALCULATE TOTALS
        // =============================================

        let totalSales = 0;

        let totalCost = 0;


        const data =
            rows.map(row => {

                const salesValue =
                    Number(
                        row.sales_value || 0
                    );


                const purchaseValue =
                    Number(
                        row.purchase_value || 0
                    );


                const profit =
                    salesValue -
                    purchaseValue;


                totalSales +=
                    salesValue;


                totalCost +=
                    purchaseValue;


                return {

                    product_id:
                        row.product_id,

                    product_name:
                        row.product_name,

                    quantity_sold:
                        Number(
                            row.quantity_sold || 0
                        ),

                    sales_value:
                        Number(
                            salesValue.toFixed(2)
                        ),

                    purchase_value:
                        Number(
                            purchaseValue.toFixed(2)
                        ),

                    profit:
                        Number(
                            profit.toFixed(2)
                        )
                };
            });


        const totalProfit =
            totalSales -
            totalCost;


        res.json({

            success: true,

            summary: {

                total_sales:
                    Number(
                        totalSales.toFixed(2)
                    ),

                total_cost:
                    Number(
                        totalCost.toFixed(2)
                    ),

                total_profit:
                    Number(
                        totalProfit.toFixed(2)
                    )
            },

            data
        });

    } catch (err) {

        console.error(
            "Profit Report Error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to generate profit report"
        });
    }
};


// =====================================================
// STOCK REPORT
// =====================================================

exports.getStockReport = async (
    req,
    res
) => {

    try {

        const businessId =
            req.businessId;


        if (!businessId) {

            return res.status(400).json({
                success: false,
                message:
                    "Business ID is required"
            });
        }


        const [rows] =
            await db.query(

                `

                SELECT

                    id,

                    category,

                    product_name,

                    product_code,

                    barcode,

                    purchase_price,

                    selling_price,

                    price_unit,

                    stock,

                    min_stock,

                    unit,

                    tax,

                    status,

                    expiry_date,


                    (
                        stock *
                        purchase_price
                    ) AS stock_value,


                    CASE

                        WHEN stock <= 0
                            THEN 'out_of_stock'

                        WHEN stock <= min_stock
                            THEN 'low_stock'

                        ELSE 'normal'

                    END AS stock_status


                FROM products

                WHERE business_id = ?


                ORDER BY

                    CASE

                        WHEN stock <= 0
                            THEN 1

                        WHEN stock <= min_stock
                            THEN 2

                        ELSE 3

                    END,

                    product_name ASC

                `,

                [businessId]
            );


        // =============================================
        // TOTALS
        // =============================================

        const totalProducts =
            rows.length;


        let totalStock = 0;

        let inventoryValue = 0;

        let lowStock = 0;

        let outOfStock = 0;


        rows.forEach(row => {

            totalStock +=
                Number(
                    row.stock || 0
                );


            inventoryValue +=
                Number(
                    row.stock_value || 0
                );


            if (
                Number(row.stock || 0) <= 0
            ) {

                outOfStock++;

            } else if (

                Number(row.stock || 0)
                <=
                Number(row.min_stock || 0)

            ) {

                lowStock++;
            }

        });


        res.json({

            success: true,

            summary: {

                total_products:
                    totalProducts,

                total_stock:
                    Number(
                        totalStock.toFixed(2)
                    ),

                inventory_value:
                    Number(
                        inventoryValue.toFixed(2)
                    ),

                low_stock:
                    lowStock,

                out_of_stock:
                    outOfStock
            },

            data:
                rows
        });

    } catch (err) {

        console.error(
            "Stock Report Error:",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to generate stock report"
        });
    }
};