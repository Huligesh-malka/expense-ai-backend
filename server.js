    require("dotenv").config();

    const express = require("express");
    const cors = require("cors");
    const path = require("path");

    const app = express();

    // ================================
    // Database Connection
    // ================================
    require("./config/db");

    // ================================
    // Routes
    // ================================
    const authRoutes = require("./routes/authRoutes");
    const receiptRoutes = require("./routes/receiptRoutes");
    const ocrRoutes = require("./routes/ocrRoutes");
    const aiRoutes = require("./routes/aiRoutes");

    
    const dashboardRoutes = require("./routes/dashboardRoutes");

    const purchaseRoutes = require("./routes/purchaseRoutes");
    const userDashboardRoutes = require("./routes/userDashboardRoutes");
    const shopLayoutRoutes=require("./routes/shopLayoutRoutes");




    const categoryRoutes = require("./routes/categoryRoutes");


    const businessRoutes = require("./routes/businessRoutes");
    const productRoutes = require("./routes/productRoutes");
    const reportRoutes = require("./routes/reportRoutes");


    const saleRoutes = require("./routes/saleRoutes");
    const customerRoutes = require("./routes/customerRoutes");


    const supplierRoutes = require("./routes/supplierRoutes");







    // ================================
    // Middleware
    // ================================
    app.use(cors());

    app.use(express.json());

    app.use(express.urlencoded({ extended: true }));

    // Serve uploaded files
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    // ================================
    // Home Route
    // ================================
    app.get("/", (req, res) => {

        res.status(200).json({
            success: true,
            project: "Expense AI Backend",
            version: "1.0.0",
            message: "Server Running Successfully 🚀"
        });

    });

    // ================================
    // API Routes
    // ================================
    app.use("/api/auth", authRoutes);

    app.use("/api/receipts", receiptRoutes);


    app.use("/api/ocr", ocrRoutes);


    app.use("/api/ai", aiRoutes);

    

    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/business", businessRoutes);

    app.use("/api/categories", categoryRoutes);
    app.use("/api/customers", customerRoutes);

    app.use("/api/purchases", purchaseRoutes);


    app.use("/api/suppliers", supplierRoutes);

    app.use("/api/shop",shopLayoutRoutes);


    app.use("/api/user", userDashboardRoutes);


    app.use("/api/sales", saleRoutes);
    // ================================



    app.use("/api/products", productRoutes);


    app.use("/api/reports", reportRoutes);
    
    // 404 Route
    // ================================
    app.use((req, res) => {

        res.status(404).json({
            success: false,
            message: "API Not Found"
        });

    });

    // ================================
    // Global Error Handler
    // ================================
    app.use((err, req, res, next) => {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message || "Internal Server Error"
        });

    });

    // ================================
    // Start Server
    // ================================
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {

        console.log(`🚀 Server Running on http://localhost:${PORT}`);

    });