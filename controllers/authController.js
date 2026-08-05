// Expense AI Backend
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebaseAdmin = require("../config/firebaseAdmin");

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
                phone: user.phone,
                profile_image: user.profile_images || null

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

// =====================================
// Google Login with Firebase Admin
// =====================================

exports.googleLogin = async (req, res) => {

    try {

        const { idToken } = req.body;

        if (!idToken) {

            return res.status(400).json({

                success: false,
                message: "Google token is required"

            });

        }

        // Verify Firebase ID Token
const decodedToken = await firebaseAdmin.auth.verifyIdToken(idToken);
        const googleId = decodedToken.uid;
        const full_name = decodedToken.name || "";
        const email = decodedToken.email;
        const profile_image = decodedToken.picture || "";

        // Check existing user

        const [users] = await db.query(

            "SELECT * FROM users WHERE email=?",

            [email]

        );

        let user;

        if (users.length === 0) {

            // Create new user
            const [result] = await db.query(

                `INSERT INTO users
                (full_name,email,google_id,profile_images,auth_provider)
                VALUES(?,?,?,?,?)`,

                [

                    full_name,
                    email,
                    googleId,
                    profile_image,
                    "google"

                ]

            );

            const [newUser] = await db.query(

                "SELECT * FROM users WHERE id=?",

                [result.insertId]

            );

            user = newUser[0];

        } else {

            // Update existing user
            user = users[0];

            await db.query(

                `UPDATE users
                 SET google_id=?,
                     profile_images=?,
                     auth_provider='google'
                 WHERE id=?`,

                [

                    googleId,
                    profile_image,
                    user.id

                ]

            );

            // Fetch the updated user to ensure we have the latest data
            const [updatedUser] = await db.query(

                "SELECT * FROM users WHERE id=?",

                [user.id]

            );

            user = updatedUser[0];

        }

        // Find Business

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
                phone: user.phone,
                profile_image: user.profile_images || profile_image

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