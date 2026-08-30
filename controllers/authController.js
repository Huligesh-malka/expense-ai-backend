// Expense AI Backend

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebaseAdmin = require("../config/firebaseAdmin");


// =====================================
// CREATE JWT
// =====================================

const createToken = (user) => {

    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
};


// =====================================
// FORMAT USER
// =====================================

const formatUser = (user) => {

    return {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile_image: user.profile_images || null
    };
};


// =====================================
// REGISTER
// =====================================

exports.register = async (req, res) => {

    try {

        const {
            full_name,
            email,
            phone,
            password
        } = req.body;


        // =====================================
        // VALIDATION
        // =====================================

        if (!full_name || !email || !password) {

            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });

        }


        // =====================================
        // CHECK EXISTING USER
        // =====================================

        const [exist] = await db.query(
            `
            SELECT id
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );


        if (exist.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });

        }


        // =====================================
        // HASH PASSWORD
        // =====================================

        const hash = await bcrypt.hash(
            password,
            10
        );


        // =====================================
        // CREATE USER
        // =====================================

        const [result] = await db.query(
            `
            INSERT INTO users
            (
                full_name,
                email,
                phone,
                password,
                role
            )
            VALUES (?, ?, ?, ?, 'user')
            `,
            [
                full_name,
                email,
                phone || null,
                hash
            ]
        );


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(201).json({

            success: true,

            message: "Registration Successful",

            userId: result.insertId

        });

    }

    catch (err) {

        console.error(
            "Register Error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Registration failed"
        });

    }

};


// =====================================
// LOGIN
// =====================================

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // =====================================
        // VALIDATION
        // =====================================

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });

        }


        // =====================================
        // FIND USER
        // =====================================

        const [users] = await db.query(
            `
            SELECT *
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );


        if (users.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });

        }


        const user = users[0];


        // =====================================
        // PASSWORD CHECK
        // =====================================

        if (!user.password) {

            return res.status(401).json({
                success: false,
                message: "Please use Google login for this account"
            });

        }


        const valid = await bcrypt.compare(
            password,
            user.password
        );


        if (!valid) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });

        }


        // =====================================
        // FIND OWNER BUSINESS
        // =====================================

        const [businesses] = await db.query(
            `
            SELECT *
            FROM businesses
            WHERE owner_id = ?
            LIMIT 1
            `,
            [user.id]
        );


        const business =
            businesses.length > 0
                ? businesses[0]
                : null;


        // =====================================
        // CREATE JWT
        // =====================================

        const token = createToken(user);


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            token,

            user: formatUser(user),

            business,

            businessId:
                business
                    ? business.id
                    : null,

            hasBusiness:
                !!business

        });

    }

    catch (err) {

        console.error(
            "Login Error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });

    }

};


// =====================================
// GOOGLE LOGIN
// =====================================

exports.googleLogin = async (req, res) => {

    try {

        const {
            idToken
        } = req.body;


        // =====================================
        // VALIDATION
        // =====================================

        if (!idToken) {

            return res.status(400).json({
                success: false,
                message: "Google token is required"
            });

        }


        // =====================================
        // VERIFY FIREBASE TOKEN
        // =====================================

        const decodedToken =
            await firebaseAdmin.auth.verifyIdToken(
                idToken
            );


        const googleId =
            decodedToken.uid;

        const full_name =
            decodedToken.name || "";

        const email =
            decodedToken.email;

        const profile_image =
            decodedToken.picture || "";


        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Google account email not available"
            });

        }


        // =====================================
        // FIND EXISTING USER
        // =====================================

        const [users] = await db.query(
            `
            SELECT *
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );


        let user;


        // =====================================
        // CREATE NEW GOOGLE USER
        // =====================================

        if (users.length === 0) {

            const [result] = await db.query(
                `
                INSERT INTO users
                (
                    full_name,
                    email,
                    google_id,
                    profile_images,
                    auth_provider,
                    role
                )
                VALUES (?, ?, ?, ?, 'google', 'user')
                `,
                [
                    full_name,
                    email,
                    googleId,
                    profile_image
                ]
            );


            const [newUsers] =
                await db.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [result.insertId]
                );


            user = newUsers[0];

        }

        else {

            // =====================================
            // EXISTING USER
            // =====================================

            user = users[0];


            await db.query(
                `
                UPDATE users
                SET
                    google_id = ?,
                    profile_images = ?,
                    auth_provider = 'google'
                WHERE id = ?
                `,
                [
                    googleId,
                    profile_image,
                    user.id
                ]
            );


            // =====================================
            // GET LATEST USER
            // =====================================

            const [updatedUsers] =
                await db.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [user.id]
                );


            user = updatedUsers[0];

        }


        // =====================================
        // FIND OWNER BUSINESS
        // =====================================

        const [businesses] = await db.query(
            `
            SELECT *
            FROM businesses
            WHERE owner_id = ?
            LIMIT 1
            `,
            [user.id]
        );


        const business =
            businesses.length > 0
                ? businesses[0]
                : null;


        // =====================================
        // CREATE JWT
        // =====================================

        const token =
            createToken(user);


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            token,

            user: formatUser(user),

            business,

            businessId:
                business
                    ? business.id
                    : null,

            hasBusiness:
                !!business

        });

    }

    catch (err) {

        console.error(
            "Google Login Error:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Google login failed"
        });

    }

};