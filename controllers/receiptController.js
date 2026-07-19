const db = require("../config/db");

exports.uploadReceipt = async (req, res) => {

    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a receipt."
            });
        }

        const userId = req.body.user_id || 1;

        const receiptImage = req.file.path.replace(/\\/g, "/");

        const originalName = req.file.originalname;

        const fileType = req.file.mimetype;

        const fileSize = req.file.size;

        const [result] = await db.query(
            `INSERT INTO receipts
            (
                user_id,
                receipt_image,
                original_file_name,
                file_type,
                file_size,
                upload_status
            )
            VALUES (?,?,?,?,?,?)`,
            [
                userId,
                receiptImage,
                originalName,
                fileType,
                fileSize,
                "uploaded"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Receipt uploaded successfully.",
            receiptId: result.insertId,
            receipt: {
                id: result.insertId,
                image: receiptImage,
                fileName: originalName,
                fileType,
                fileSize
            }
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};