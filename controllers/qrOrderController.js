// ============================================================
// OWNER - GET QR ORDERS
//
// OWNER DASHBOARD
//
// No restaurant/table JOIN.
// ============================================================

exports.getQROrders = async (req, res) => {

    try {

        const businessId =
            req.businessId;


        if (!businessId) {
            return res.status(400).json({
                success: false,
                message: "Business not found"
            });
        }


        const {
            status
        } = req.query;


        let query = `
            SELECT

                q.id,

                q.order_no,

                q.business_id,

                q.customer_name,

                q.customer_phone,

                q.subtotal,

                q.discount,

                q.tax,

                q.total_amount,

                q.order_status,

                q.payment_method,

                q.payment_status,

                q.stock_deducted,

                q.notes,

                q.created_at,

                q.updated_at

            FROM qr_orders q

            WHERE q.business_id = ?
        `;


        const params =
            [businessId];


        if (status) {

            query += `
                AND q.order_status = ?
            `;

            params.push(status);
        }


        query += `
            ORDER BY
                q.created_at DESC
        `;


        const [orders] =
            await db.query(
                query,
                params
            );


        // --------------------------------------------------------
        // GET ORDER ITEMS
        // --------------------------------------------------------

        for (
            const order of orders
        ) {

            const [items] =
                await db.query(
                    `
                    SELECT

                        id,

                        product_id,

                        product_name,

                        quantity,

                        unit,

                        unit_price,

                        tax_rate,

                        tax_amount,

                        total,

                        notes

                    FROM qr_order_items

                    WHERE order_id = ?

                    ORDER BY id ASC
                    `,
                    [order.id]
                );


            order.items =
                items;
        }


        res.json({

            success: true,

            total:
                orders.length,

            data:
                orders
        });


    } catch (err) {

        console.error(
            "Get QR Orders Error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Failed to get QR orders"
        });
    }
};


// ============================================================
// OWNER - GET SINGLE QR ORDER
// ============================================================

exports.getQROrder = async (req, res) => {

    try {

        const businessId =
            req.businessId;

        const { id } =
            req.params;


        const [orders] =
            await db.query(
                `
                SELECT
                    q.*

                FROM qr_orders q

                WHERE q.id = ?

                AND q.business_id = ?

                LIMIT 1
                `,
                [
                    id,
                    businessId
                ]
            );


        if (orders.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "QR order not found"
            });
        }


        const order =
            orders[0];


        const [items] =
            await db.query(
                `
                SELECT *

                FROM qr_order_items

                WHERE order_id = ?

                ORDER BY id ASC
                `,
                [id]
            );


        order.items =
            items;


        res.json({

            success: true,

            data:
                order
        });


    } catch (err) {

        console.error(
            "Get QR Order Error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Failed to get QR order"
        });
    }
};


// ============================================================
// OWNER - UPDATE QR ORDER STATUS
//
// STATUS:
//
// new
// accepted
// processing
// ready
// completed
// rejected
// cancelled
//
// IMPORTANT:
// ACCEPTED DOES NOT DEDUCT STOCK.
//
// PAYMENT MUST BE CONFIRMED FIRST.
// ============================================================

exports.updateQROrderStatus = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        await connection.beginTransaction();


        const businessId =
            req.businessId;

        const { id } =
            req.params;

        const { status } =
            req.body;


        const validStatuses = [

            "new",

            "accepted",

            "processing",

            "ready",

            "completed",

            "rejected",

            "cancelled"
        ];


        if (
            !validStatuses.includes(
                status
            )
        ) {

            await connection.rollback();


            return res.status(400).json({

                success: false,

                message:
                    "Invalid order status"
            });
        }


        // --------------------------------------------------------
        // GET ORDER
        // --------------------------------------------------------

        const [orders] =
            await connection.query(
                `
                SELECT *

                FROM qr_orders

                WHERE id = ?

                AND business_id = ?

                FOR UPDATE
                `,
                [
                    id,
                    businessId
                ]
            );


        if (orders.length === 0) {

            await connection.rollback();


            return res.status(404).json({

                success: false,

                message:
                    "QR order not found"
            });
        }


        const order =
            orders[0];


        // --------------------------------------------------------
        // COMPLETED ORDER CANNOT BE CHANGED
        // --------------------------------------------------------

        if (
            order.order_status ===
                "completed" &&
            status !==
                "completed"
        ) {

            throw new Error(
                "Completed order cannot be changed"
            );
        }


        // --------------------------------------------------------
        // ACCEPT ORDER
        //
        // Customer now gets permission/instruction
        // to pay owner.
        // --------------------------------------------------------

        if (
            status === "accepted"
        ) {

            if (
                order.order_status !==
                    "new"
            ) {

                throw new Error(
                    "Only new orders can be accepted"
                );
            }


            await connection.query(
                `
                UPDATE qr_orders

                SET
                    order_status = 'accepted'

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Order accepted. Customer can now pay.",

                order_status:
                    "accepted",

                payment_status:
                    order.payment_status
            });
        }


        // --------------------------------------------------------
        // REJECT / CANCEL
        // --------------------------------------------------------

        if (
            status === "rejected" ||
            status === "cancelled"
        ) {

            // If stock was already deducted,
            // do not restore it here.
            //
            // Paid orders should be handled through
            // refund/business logic separately.

            if (
                order.stock_deducted
            ) {

                throw new Error(
                    "Stock has already been deducted. Use refund/cancellation flow."
                );
            }


            await connection.query(
                `
                UPDATE qr_orders

                SET
                    order_status = ?

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    status,
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    `Order ${status}`,

                order_status:
                    status
            });
        }


        // --------------------------------------------------------
        // PROCESSING / READY / COMPLETED
        //
        // Payment must be confirmed first.
        // --------------------------------------------------------

        if (
            status === "processing" ||
            status === "ready" ||
            status === "completed"
        ) {

            if (
                order.payment_status !==
                    "paid"
            ) {

                throw new Error(
                    "Payment must be confirmed before processing the order"
                );
            }
        }


        await connection.query(
            `
            UPDATE qr_orders

            SET
                order_status = ?

            WHERE id = ?

            AND business_id = ?
            `,
            [
                status,
                id,
                businessId
            ]
        );


        await connection.commit();


        res.json({

            success: true,

            message:
                "QR order status updated",

            order_status:
                status
        });


    } catch (err) {

        await connection.rollback();


        console.error(
            "Update QR Order Status Error:",
            err
        );


        res.status(400).json({

            success: false,

            message:
                err.message ||
                "Failed to update QR order"
        });


    } finally {

        connection.release();
    }
};


// ============================================================
// OWNER - UPDATE PAYMENT
//
// CURRENT PAYMENT FLOW:
//
// Owner accepts order
//        ↓
// Customer pays owner directly
//        ↓
// Owner confirms payment
//        ↓
// Stock deducted
//
// IMPORTANT:
// This endpoint is OWNER CONFIRMATION.
//
// It does NOT verify a UPI transaction automatically.
//
// Later you can integrate payment verification.
// ============================================================

exports.updateQRPayment = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        await connection.beginTransaction();


        const businessId =
            req.businessId;

        const { id } =
            req.params;


        const {
            payment_method,
            payment_status
        } = req.body;


        const validPaymentStatuses = [

            "pending",

            "paid",

            "failed"
        ];


        if (
            !validPaymentStatuses.includes(
                payment_status
            )
        ) {

            await connection.rollback();


            return res.status(400).json({

                success: false,

                message:
                    "Invalid payment status"
            });
        }


        // --------------------------------------------------------
        // GET ORDER
        // --------------------------------------------------------

        const [orders] =
            await connection.query(
                `
                SELECT *

                FROM qr_orders

                WHERE id = ?

                AND business_id = ?

                FOR UPDATE
                `,
                [
                    id,
                    businessId
                ]
            );


        if (orders.length === 0) {

            await connection.rollback();


            return res.status(404).json({

                success: false,

                message:
                    "QR order not found"
            });
        }


        const order =
            orders[0];


        // --------------------------------------------------------
        // PAYMENT PENDING
        // --------------------------------------------------------

        if (
            payment_status ===
                "pending"
        ) {

            await connection.query(
                `
                UPDATE qr_orders

                SET

                    payment_method = ?,

                    payment_status = 'pending'

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    payment_method ||
                        null,

                    id,

                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Payment set to pending",

                payment_status:
                    "pending"
            });
        }


        // --------------------------------------------------------
        // PAYMENT FAILED
        // --------------------------------------------------------

        if (
            payment_status ===
                "failed"
        ) {

            await connection.query(
                `
                UPDATE qr_orders

                SET

                    payment_method = ?,

                    payment_status = 'failed'

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    payment_method ||
                        null,

                    id,

                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Payment marked as failed",

                payment_status:
                    "failed"
            });
        }


        // --------------------------------------------------------
        // PAYMENT PAID
        // --------------------------------------------------------

        if (
            payment_status ===
                "paid"
        ) {

            // ----------------------------------------------------
            // OWNER MUST ACCEPT FIRST
            // ----------------------------------------------------

            if (
                order.order_status !==
                    "accepted"
            ) {

                throw new Error(
                    "Owner must accept the order before payment confirmation"
                );
            }


            // ----------------------------------------------------
            // ALREADY PAID
            // ----------------------------------------------------

            if (
                order.payment_status ===
                    "paid"
            ) {

                await connection.commit();


                return res.json({

                    success: true,

                    message:
                        "Payment is already confirmed",

                    payment_status:
                        "paid",

                    stock_deducted:
                        Boolean(
                            order.stock_deducted
                        )
                });
            }


            // ----------------------------------------------------
            // GET ORDER ITEMS
            // ----------------------------------------------------

            const [items] =
                await connection.query(
                    `
                    SELECT

                        product_id,

                        product_name,

                        quantity

                    FROM qr_order_items

                    WHERE order_id = ?
                    `,
                    [id]
                );


            if (
                items.length === 0
            ) {

                throw new Error(
                    "Order has no items"
                );
            }


            // ----------------------------------------------------
            // DEDUCT STOCK ONLY ON PAYMENT
            // ----------------------------------------------------

            if (
                !order.stock_deducted
            ) {

                for (
                    const item of items
                ) {

                    const [
                        productRows
                    ] =
                        await connection.query(
                            `
                            SELECT

                                id,

                                product_name,

                                stock,

                                status

                            FROM products

                            WHERE id = ?

                            AND business_id = ?

                            FOR UPDATE
                            `,
                            [
                                item.product_id,

                                businessId
                            ]
                        );


                    if (
                        productRows.length ===
                        0
                    ) {

                        throw new Error(
                            `${item.product_name} no longer exists`
                        );
                    }


                    const product =
                        productRows[0];


                    if (
                        product.status !==
                            "active"
                    ) {

                        throw new Error(
                            `${product.product_name} is inactive`
                        );
                    }


                    if (
                        Number(
                            product.stock
                        ) <
                        Number(
                            item.quantity
                        )
                    ) {

                        throw new Error(
                            `${product.product_name} - Only ${product.stock} available`
                        );
                    }


                    await connection.query(
                        `
                        UPDATE products

                        SET
                            stock =
                            stock - ?

                        WHERE id = ?

                        AND business_id = ?
                        `,
                        [
                            item.quantity,

                            item.product_id,

                            businessId
                        ]
                    );
                }
            }


            // ----------------------------------------------------
            // MARK PAYMENT PAID
            // ----------------------------------------------------

            await connection.query(
                `
                UPDATE qr_orders

                SET

                    payment_method = ?,

                    payment_status = 'paid',

                    stock_deducted = TRUE

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    payment_method ||
                        "UPI",

                    id,

                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Payment confirmed and stock updated",

                payment_status:
                    "paid",

                stock_deducted:
                    true,

                order_id:
                    order.id,

                order_no:
                    order.order_no,

                total_amount:
                    order.total_amount
            });
        }


    } catch (err) {

        await connection.rollback();


        console.error(
            "Update QR Payment Error:",
            err
        );


        res.status(400).json({

            success: false,

            message:
                err.message ||
                "Failed to update payment"
        });


    } finally {

        connection.release();
    }
};



// ============================================================
// OWNER - GET QR ORDERS
//
// OWNER DASHBOARD
//
// Returns all QR orders for the logged-in business.
//
// Optional query:
// ?status=new
// ?status=accepted
// ?status=processing
// ?status=ready
// ?status=completed
// ?status=rejected
// ?status=cancelled
// ============================================================

exports.getQROrders = async (req, res) => {

    try {

        const businessId = req.businessId;


        if (!businessId) {

            return res.status(400).json({

                success: false,

                message:
                    "Business not found"

            });
        }


        const {
            status
        } = req.query;


        let query = `
            SELECT

                q.id,

                q.business_id,

                q.order_no,

                q.customer_name,

                q.customer_phone,

                q.subtotal,

                q.discount,

                q.tax,

                q.total_amount,

                q.order_status,

                q.payment_method,

                q.payment_status,

                q.stock_deducted,

                q.notes,

                q.created_at,

                q.updated_at

            FROM qr_orders q

            WHERE q.business_id = ?
        `;


        const params = [
            businessId
        ];


        // --------------------------------------------------------
        // OPTIONAL STATUS FILTER
        // --------------------------------------------------------

        if (status) {

            query += `
                AND q.order_status = ?
            `;

            params.push(status);
        }


        query += `
            ORDER BY
                q.created_at DESC
        `;


        const [orders] =
            await db.query(
                query,
                params
            );


        // --------------------------------------------------------
        // LOAD ITEMS FOR EACH ORDER
        // --------------------------------------------------------

        for (
            const order of orders
        ) {

            const [items] =
                await db.query(
                    `
                    SELECT

                        id,

                        order_id,

                        product_id,

                        product_name,

                        quantity,

                        unit,

                        unit_price,

                        tax_rate,

                        tax_amount,

                        total,

                        notes,

                        created_at

                    FROM qr_order_items

                    WHERE order_id = ?

                    ORDER BY id ASC
                    `,
                    [
                        order.id
                    ]
                );


            order.items =
                items;
        }


        res.json({

            success: true,

            total:
                orders.length,

            data:
                orders

        });


    } catch (err) {

        console.error(
            "Get QR Orders Error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Failed to get QR orders"

        });
    }
};


// ============================================================
// OWNER - GET SINGLE QR ORDER
//
// GET:
// /qr-order/orders/:id
//
// Returns complete order details.
// ============================================================

exports.getQROrder = async (req, res) => {

    try {

        const businessId =
            req.businessId;

        const { id } =
            req.params;


        if (!businessId) {

            return res.status(400).json({

                success: false,

                message:
                    "Business not found"

            });
        }


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ID is required"

            });
        }


        // --------------------------------------------------------
        // GET ORDER
        // --------------------------------------------------------

        const [orders] =
            await db.query(
                `
                SELECT

                    q.id,

                    q.business_id,

                    q.order_no,

                    q.customer_name,

                    q.customer_phone,

                    q.subtotal,

                    q.discount,

                    q.tax,

                    q.total_amount,

                    q.order_status,

                    q.payment_method,

                    q.payment_status,

                    q.stock_deducted,

                    q.notes,

                    q.created_at,

                    q.updated_at

                FROM qr_orders q

                WHERE q.id = ?

                AND q.business_id = ?

                LIMIT 1
                `,
                [
                    id,
                    businessId
                ]
            );


        if (orders.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "QR order not found"

            });
        }


        const order =
            orders[0];


        // --------------------------------------------------------
        // GET ORDER ITEMS
        // --------------------------------------------------------

        const [items] =
            await db.query(
                `
                SELECT

                    id,

                    order_id,

                    product_id,

                    product_name,

                    quantity,

                    unit,

                    unit_price,

                    tax_rate,

                    tax_amount,

                    total,

                    notes,

                    created_at

                FROM qr_order_items

                WHERE order_id = ?

                ORDER BY id ASC
                `,
                [
                    id
                ]
            );


        order.items =
            items;


        res.json({

            success: true,

            data:
                order

        });


    } catch (err) {

        console.error(
            "Get QR Order Error:",
            err
        );


        res.status(500).json({

            success: false,

            message:
                err.message ||
                "Failed to get QR order"

        });
    }
};


// ============================================================
// OWNER - UPDATE QR ORDER STATUS
//
// Possible statuses:
//
// new
// accepted
// processing
// ready
// completed
// rejected
// cancelled
//
// IMPORTANT:
//
// ACCEPTED:
// Customer can now pay the owner.
//
// PROCESSING / READY / COMPLETED:
// Payment must already be confirmed.
//
// Stock is NOT deducted here.
//
// Stock is deducted only when payment is confirmed.
// ============================================================

exports.updateQROrderStatus = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        await connection.beginTransaction();


        const businessId =
            req.businessId;

        const { id } =
            req.params;

        const { status } =
            req.body;


        if (!businessId) {

            throw new Error(
                "Business not found"
            );
        }


        if (!id) {

            throw new Error(
                "Order ID is required"
            );
        }


        const validStatuses = [

            "new",

            "accepted",

            "processing",

            "ready",

            "completed",

            "rejected",

            "cancelled"

        ];


        if (
            !validStatuses.includes(
                status
            )
        ) {

            throw new Error(
                "Invalid order status"
            );
        }


        // --------------------------------------------------------
        // GET ORDER WITH LOCK
        // --------------------------------------------------------

        const [orders] =
            await connection.query(
                `
                SELECT *

                FROM qr_orders

                WHERE id = ?

                AND business_id = ?

                FOR UPDATE
                `,
                [
                    id,
                    businessId
                ]
            );


        if (orders.length === 0) {

            throw new Error(
                "QR order not found"
            );
        }


        const order =
            orders[0];


        // --------------------------------------------------------
        // ALREADY COMPLETED
        // --------------------------------------------------------

        if (
            order.order_status ===
                "completed"
        ) {

            throw new Error(
                "Completed order cannot be changed"
            );
        }


        // --------------------------------------------------------
        // ACCEPT ORDER
        // --------------------------------------------------------

        if (
            status === "accepted"
        ) {

            if (
                order.order_status !==
                    "new"
            ) {

                throw new Error(
                    "Only new orders can be accepted"
                );
            }


            await connection.query(
                `
                UPDATE qr_orders

                SET

                    order_status =
                        'accepted',

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Order accepted. Customer can now pay the owner.",

                data: {

                    order_id:
                        order.id,

                    order_no:
                        order.order_no,

                    order_status:
                        "accepted",

                    payment_status:
                        order.payment_status

                }

            });
        }


        // --------------------------------------------------------
        // REJECT ORDER
        // --------------------------------------------------------

        if (
            status === "rejected"
        ) {

            if (
                order.payment_status ===
                    "paid"
            ) {

                throw new Error(
                    "Paid order cannot be rejected. Use the refund process."
                );
            }


            if (
                order.stock_deducted
            ) {

                throw new Error(
                    "Stock has already been deducted."
                );
            }


            await connection.query(
                `
                UPDATE qr_orders

                SET

                    order_status =
                        'rejected',

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Order rejected",

                data: {

                    order_id:
                        order.id,

                    order_no:
                        order.order_no,

                    order_status:
                        "rejected"

                }

            });
        }


        // --------------------------------------------------------
        // CANCEL ORDER
        // --------------------------------------------------------

        if (
            status === "cancelled"
        ) {

            if (
                order.payment_status ===
                    "paid"
            ) {

                throw new Error(
                    "Paid order cannot be cancelled without refund handling."
                );
            }


            if (
                order.stock_deducted
            ) {

                throw new Error(
                    "Stock has already been deducted."
                );
            }


            await connection.query(
                `
                UPDATE qr_orders

                SET

                    order_status =
                        'cancelled',

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?

                AND business_id = ?
                `,
                [
                    id,
                    businessId
                ]
            );


            await connection.commit();


            return res.json({

                success: true,

                message:
                    "Order cancelled",

                data: {

                    order_id:
                        order.id,

                    order_no:
                        order.order_no,

                    order_status:
                        "cancelled"

                }

            });
        }


        // --------------------------------------------------------
        // PROCESSING / READY / COMPLETED
        //
        // PAYMENT MUST BE PAID FIRST.
        // --------------------------------------------------------

        if (

            status ===
                "processing"

            ||

            status ===
                "ready"

            ||

            status ===
                "completed"

        ) {

            if (
                order.payment_status !==
                    "paid"
            ) {

                throw new Error(
                    "Payment must be confirmed before processing the order."
                );
            }


            if (
                status ===
                    "processing"
            ) {

                if (
                    ![
                        "accepted",
                        "processing"
                    ].includes(
                        order.order_status
                    )
                ) {

                    throw new Error(
                        "Order must be accepted before processing."
                    );
                }
            }


            if (
                status ===
                    "ready"
            ) {

                if (
                    ![
                        "processing",
                        "ready"
                    ].includes(
                        order.order_status
                    )
                ) {

                    throw new Error(
                        "Order must be processing before it can be marked ready."
                    );
                }
            }


            if (
                status ===
                    "completed"
            ) {

                if (
                    ![
                        "ready",
                        "completed"
                    ].includes(
                        order.order_status
                    )
                ) {

                    throw new Error(
                        "Order must be ready before it can be completed."
                    );
                }
            }
        }


        // --------------------------------------------------------
        // UPDATE STATUS
        // --------------------------------------------------------

        await connection.query(
            `
            UPDATE qr_orders

            SET

                order_status = ?,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?

            AND business_id = ?
            `,
            [
                status,

                id,

                businessId
            ]
        );


        await connection.commit();


        res.json({

            success: true,

            message:
                "QR order status updated successfully",

            data: {

                order_id:
                    order.id,

                order_no:
                    order.order_no,

                order_status:
                    status,

                payment_status:
                    order.payment_status,

                stock_deducted:
                    Boolean(
                        order.stock_deducted
                    )

            }

        });


    } catch (err) {

        await connection.rollback();


        console.error(
            "Update QR Order Status Error:",
            err
        );


        res.status(400).json({

            success: false,

            message:
                err.message ||
                "Failed to update QR order status"

        });


    } finally {

        connection.release();

    }
};
