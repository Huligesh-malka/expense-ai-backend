// Expense AI Backend
function parseReceipt(text) {

    const data = {
        company_name: "",
        invoice_number: "",
        invoice_date: "",
        gst_number: "",
        total_amount: "",
        cgst: "",
        sgst: "",
        items: []
    };

    // Company Name
    const lines = text.split("\n").filter(line => line.trim() !== "");
    if (lines.length > 0) {
        data.company_name = lines[0].trim();
    }

    // Invoice Number
    const invoiceMatch = text.match(/Invoice\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\/\-]+)/i);
    if (invoiceMatch) {
        data.invoice_number = invoiceMatch[1];
    }

    // Date
    const dateMatch = text.match(/\d{2}[-\/]\w{3}[-\/]\d{4}|\d{2}[-\/]\d{2}[-\/]\d{4}/);
    if (dateMatch) {
        data.invoice_date = dateMatch[0];
    }

    // GST Number
    const gstMatch = text.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]/);
    if (gstMatch) {
        data.gst_number = gstMatch[0];
    }

    // Total Amount
    const totalMatch = text.match(/Total.*?([\d,]+\.\d{2})/is);
    if (totalMatch) {
        data.total_amount = totalMatch[1];
    }

    // CGST
    const cgstMatch = text.match(/CGST.*?([\d,]+\.\d{2})/i);
    if (cgstMatch) {
        data.cgst = cgstMatch[1];
    }

    // SGST
    const sgstMatch = text.match(/SGST.*?([\d,]+\.\d{2})/i);
    if (sgstMatch) {
        data.sgst = sgstMatch[1];
    }

    return data;
}

module.exports = parseReceipt;