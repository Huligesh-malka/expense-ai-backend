const db = require("../config/db");
const extractText = require("../utils/ocr");

exports.scanReceipt = async (req, res) => {

    try {

        const { receiptId } = req.params;

        // =========================
        // Find Receipt
        // =========================

        const [receipt] = await db.query(

            `SELECT *
             FROM receipts
             WHERE id=?`,

            [receiptId]

        );

        if (receipt.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Receipt not found"

            });

        }

        const imagePath = receipt[0].receipt_image;

        console.log("Receipt :", receiptId);
        console.log("Image :", imagePath);

        // =========================
        // OCR
        // =========================

        const extractedText = await extractText(imagePath);

        if (!extractedText || extractedText.trim() === "") {

            await db.query(

                `UPDATE receipts
                 SET upload_status='ocr_failed'
                 WHERE id=?`,

                [receiptId]

            );

            return res.status(400).json({

                success: false,
                message: "Unable to read receipt."

            });

        }

        console.log("================ OCR ================");
        console.log(extractedText);
        console.log("=====================================");

        // =========================
        // Save OCR
        // =========================

        const [exist] = await db.query(

            `SELECT id
             FROM ai_logs
             WHERE receipt_id=?`,

            [receiptId]

        );

        if (exist.length > 0) {

            await db.query(

                `UPDATE ai_logs
                 SET
                    extracted_text=?,
                    ai_response=NULL,
                    created_at=NOW()
                 WHERE receipt_id=?`,

                [
                    extractedText,
                    receiptId
                ]

            );

        }

        else {

            await db.query(

                `INSERT INTO ai_logs
                (
                    receipt_id,
                    extracted_text,
                    created_at
                )
                VALUES
                (
                    ?,?,
                    NOW()
                )`,

                [
                    receiptId,
                    extractedText
                ]

            );

        }

        // =========================
        // Update Receipt Status
        // =========================

        await db.query(

            `UPDATE receipts
             SET
                upload_status='ocr_completed'
             WHERE id=?`,

            [receiptId]

        );

        // =========================
        // Response
        // =========================

        res.json({

            success: true,

            message: "OCR Completed Successfully",

            receiptId,

            extractedText

        });

    }

    catch (err) {

        console.log(err);

        await db.query(

            `UPDATE receipts
             SET upload_status='ocr_failed'
             WHERE id=?`,

            [req.params.receiptId]

        ).catch(() => {});

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};