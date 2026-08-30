require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();


// =====================================
// DATABASE CONNECTION
// =====================================

require("./config/db");


// =====================================
// SECURITY ENGINE
// =====================================

// Security headers
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);


// =====================================
// CORS
// =====================================

app.use(
    cors({
        origin: [
            "https://expense-ai-frontend.vercel.app"
        ],
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ],  
        credentials: false
    })
);


// =====================================
// REQUEST BODY LIMIT
// =====================================

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);


// =====================================
// GLOBAL API RATE LIMIT
// =====================================

const apiRateLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 300,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }

});

app.use(
    "/api",
    apiRateLimiter
);


// =====================================
// ROUTES
// =====================================

const authRoutes = require("./routes/authRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const ocrRoutes = require("./routes/ocrRoutes");
const aiRoutes = require("./routes/aiRoutes");

const qrOrderRoutes = require("./routes/qrOrderRoutes");

const dashboardRoutes = require("./routes/dashboardRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const userDashboardRoutes = require("./routes/userDashboardRoutes");
const shopLayoutRoutes = require("./routes/shopLayoutRoutes");

const categoryRoutes = require("./routes/categoryRoutes");

const businessRoutes = require("./routes/businessRoutes");
const productRoutes = require("./routes/productRoutes");
const reportRoutes = require("./routes/reportRoutes");

const saleRoutes = require("./routes/saleRoutes");
const customerRoutes = require("./routes/customerRoutes");

const supplierRoutes = require("./routes/supplierRoutes");

const adminRoutes = require("./routes/adminRoutes");


// =====================================
// UPLOADED FILES
// =====================================

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);


// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {

    res.status(200).json({
        success: true,
        project: "Expense AI Backend",
        version: "1.0.0",
        message: "Server Running Successfully 🚀"
    });

});


// =====================================
// API ROUTES
// =====================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/admin",
    adminRoutes
);

app.use(
    "/api/receipts",
    receiptRoutes
);

app.use(
    "/api/ocr",
    ocrRoutes
);

app.use(
    "/api/ai",
    aiRoutes
);

app.use(
    "/api/dashboard",
    dashboardRoutes
);

app.use(
    "/api/business",
    businessRoutes
);

app.use(
    "/api/categories",
    categoryRoutes
);

app.use(
    "/api/customers",
    customerRoutes
);

app.use(
    "/api/purchases",
    purchaseRoutes
);

app.use(
    "/api/suppliers",
    supplierRoutes
);

app.use(
    "/api/shop",
    shopLayoutRoutes
);

app.use(
    "/api/qr-order",
    qrOrderRoutes
);

app.use(
    "/api/user",
    userDashboardRoutes
);

app.use(
    "/api/sales",
    saleRoutes
);

app.use(
    "/api/products",
    productRoutes
);

app.use(
    "/api/reports",
    reportRoutes
);


// =====================================
// 404
// =====================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "API Not Found"
    });

});


// =====================================
// GLOBAL ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {

    console.error(
        "Global Error:",
        err
    );

    res.status(
        err.status || 500
    ).json({

        success: false,

        message:
            process.env.NODE_ENV === "production"
                ? "Internal Server Error"
                : err.message

    });

});


// =====================================
// START SERVER
// =====================================

const PORT =
    process.env.PORT || 5000;

app.listen(
    PORT,
    () => {

        console.log(
            `🚀 Server Running on port ${PORT}`
        );

    }
);