require("dotenv").config();

const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ssl: {
        rejectUnauthorized: true
    }
});

(async () => {
    try {
        const connection = await db.getConnection();

        console.log("✅ TiDB Connected Successfully");

        connection.release();

    } catch (err) {

        console.error("❌ Database Connection Failed");
        console.error(err);

    }
})();

module.exports = db;