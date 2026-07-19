// Expense AI Backend

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// =====================================
// Register
// =====================================

exports.register = async (req, res) => {

    try {

        const { full_name, email, phone, password } = req.body;

        const [exist] = await db.query(

            "SELECT id FROM users WHERE email=?",

            [email]

        );

        if (exist.length > 0) {

            return res.json({

                success: false,
                message: "Email already exists"

            });

        }

        const hash = await bcrypt.hash(password, 10);

        const [result] = await db.query(

            "INSERT INTO users(full_name,email,phone,password) VALUES(?,?,?,?)",

            [

                full_name,
                email,
                phone,
                hash

            ]

        );

        res.json({

            success: true,
            message: "Registration Successful",

            userId: result.insertId

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

// =====================================
// Login
// =====================================

exports.login = async (req, res) => {

    try {

        const { email, password } = req.body;

        const [users] = await db.query(

            "SELECT * FROM users WHERE email=?",

            [email]

        );

        if (users.length === 0) {

            return res.json({

                success: false,
                message: "User not found"

            });

        }

        const user = users[0];

        const valid = await bcrypt.compare(

            password,

            user.password

        );

        if (!valid) {

            return res.json({

                success: false,
                message: "Wrong Password"

            });

        }

        // Find Owner Business

        const [businesses] = await db.query(

            "SELECT * FROM businesses WHERE owner_id=? LIMIT 1",

            [user.id]

        );

        const business = businesses.length > 0
            ? businesses[0]
            : null;

        const token = jwt.sign(

            {

                id: user.id

            },

            process.env.JWT_SECRET,

            {

                expiresIn: "7d"

            }

        );

        res.json({

            success: true,

            token,

            user: {

                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone

            },

            business,

            businessId: business ? business.id : null,

            hasBusiness: business ? true : false

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