const db = require("../config/db");
const groq = require("../config/groq");

exports.parseReceiptAI = async (req, res) => {

    try {

        const { receiptId } = req.params;

        // ===========================
        // Get OCR Text
        // ===========================

        const [rows] = await db.query(
            `SELECT extracted_text
             FROM ai_logs
             WHERE receipt_id=?
             ORDER BY id DESC
             LIMIT 1`,
            [receiptId]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "OCR data not found"
            });

        }

        const ocrText = rows[0].extracted_text;

        // ===========================
        // AI Prompt
        // ===========================

        const completion = await groq.chat.completions.create({

            model: "llama-3.3-70b-versatile",

            temperature: 0,

            response_format: {
                type: "json_object"
            },

            messages: [

                {
                    role: "system",
                    content: `
You are the world's best Invoice & Receipt AI.

Read OCR carefully.

Never guess.

Return ONLY JSON.

If a value is missing return:
"" for text
0 for numbers
[] for arrays

Extract EVERYTHING.

JSON FORMAT

{
  "company_name":"",
  "seller_name":"",
  "buyer_name":"",
  "invoice_number":"",
  "invoice_date":"",
  "due_date":"",
  "gst_number":"",
  "pan_number":"",
  "phone":"",
  "email":"",
  "website":"",
  "address":"",
  "city":"",
  "state":"",
  "country":"",
  "payment_method":"",
  "currency":"INR",

  "subtotal":0,
  "discount":0,
  "cgst":0,
  "sgst":0,
  "igst":0,
  "cess":0,
  "shipping":0,
  "other_charges":0,
  "round_off":0,
  "total_tax":0,
  "grand_total":0,

  "items":[
    {
      "name":"",
      "hsn":"",
      "quantity":0,
      "unit":"",
      "unit_price":0,
      "discount":0,
      "gst_percent":0,
      "gst_amount":0,
      "amount":0
    }
  ]
}

Rules

Invoice date must be YYYY-MM-DD.

Grand total must be the final payable amount.

Read every product.

Read HSN if available.

Read GST percentage.

Read quantity correctly.

Read unit price correctly.

Read line amount correctly.

Never invent products.

Never explain.

Return only JSON.
`
                },

                {
                    role: "user",
                    content: ocrText
                }

            ]

        });

        const aiResponse =
            completion.choices[0].message.content;

        // ===========================
        // Save Raw AI Response
        // ===========================

        await db.query(

            `UPDATE ai_logs
             SET ai_response=?
             WHERE receipt_id=?`,

            [
                aiResponse,
                receiptId
            ]

        );

        // ===========================
        // Parse JSON
        // ===========================

        let clean = aiResponse
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let parsed;

        try {

            parsed = JSON.parse(clean);

        }

        catch (err) {

            return res.status(500).json({

                success: false,

                message: "Invalid AI JSON",

                raw: clean

            });

        }

        // ===========================
        // Calculate Totals if Missing
        // ===========================

        if (
            Array.isArray(parsed.items) &&
            parsed.items.length > 0
        ) {

            let subtotal = 0;

            parsed.items.forEach(item => {

                item.quantity = Number(item.quantity) || 1;

                item.unit_price =
                    Number(item.unit_price) || 0;

                item.discount =
                    Number(item.discount) || 0;

                item.gst_percent =
                    Number(item.gst_percent) || 0;

                item.amount =
                    Number(item.amount) ||
                    item.quantity * item.unit_price;

                item.gst_amount =
                    Number(item.gst_amount) ||
                    ((item.amount - item.discount)
                        * item.gst_percent / 100);

                subtotal += item.amount;

            });

            if (!parsed.subtotal)
                parsed.subtotal = subtotal;

            if (!parsed.total_tax)
                parsed.total_tax =
                    (parsed.cgst || 0) +
                    (parsed.sgst || 0) +
                    (parsed.igst || 0);

            if (!parsed.grand_total)
                parsed.grand_total =
                    parsed.subtotal -
                    (parsed.discount || 0) +
                    parsed.total_tax +
                    (parsed.shipping || 0) +
                    (parsed.other_charges || 0);

        }

        // ===========================
        // Return JSON
        // ===========================

        res.json({

            success: true,

            data: parsed

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};