const db = require("../config/db");

// User Dashboard
exports.getDashboard = async (req, res) => {

    try {

        const userId = req.user.id;

        // Total Bills
        const [billResult] = await db.query(`
            SELECT COUNT(*) AS totalBills
            FROM sales
            WHERE customer_id = ?
        `,[userId]);

        // Total Spent
        const [spentResult] = await db.query(`
            SELECT IFNULL(SUM(total_amount),0) AS totalSpent
            FROM sales
            WHERE customer_id = ?
        `,[userId]);

        // This Month Spending
        const [monthResult] = await db.query(`
            SELECT IFNULL(SUM(total_amount),0) AS monthlySpent
            FROM sales
            WHERE customer_id = ?
            AND MONTH(created_at)=MONTH(CURRENT_DATE())
            AND YEAR(created_at)=YEAR(CURRENT_DATE())
        `,[userId]);

        // Last Purchase
        const [lastPurchase] = await db.query(`
            SELECT
                sale_number,
                total_amount,
                created_at
            FROM sales
            WHERE customer_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `,[userId]);

        // Recent Bills
        const [recentBills] = await db.query(`
            SELECT
                s.id,
                s.sale_number,
                s.total_amount,
                s.created_at,
                b.business_name
            FROM sales s
            JOIN businesses b
            ON b.id=s.business_id
            WHERE s.customer_id=?
            ORDER BY s.created_at DESC
            LIMIT 10
        `,[userId]);

        res.json({

            success:true,

            dashboard:{

                totalBills:billResult[0].totalBills,

                totalSpent:spentResult[0].totalSpent,

                monthlySpent:monthResult[0].monthlySpent,

                lastPurchase:lastPurchase[0] || null,

                recentBills

            }

        });

    } catch(err){

        console.log(err);

        res.status(500).json({
            success:false,
            message:"Server Error"
        });

    }

}