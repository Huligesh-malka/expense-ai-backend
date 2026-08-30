// Expense AI Backend
// controllers/authController.js

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebaseAdmin = require("../config/firebaseAdmin");

const {
    logSecurityEvent
} = require("../middleware/securityLogger.js");


// =====================================
// SECURITY SETTINGS
// =====================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 5;


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
            expiresIn: "1h"
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

        profile_image:
            user.profile_images || null

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

        if (
            !full_name ||
            !email ||
            !password
        ) {

            await logSecurityEvent({

                eventType:
                    "REGISTER_VALIDATION_FAILED",

                severity: "low",

                req,

                statusCode: 400,

                details: {
                    reason:
                        "Name, email or password missing"
                }

            });


            return res.status(400).json({

                success: false,

                message:
                    "Name, email and password are required"

            });

        }


        // =====================================
        // NORMALIZE EMAIL
        // =====================================

        const normalizedEmail =
            String(email)
                .trim()
                .toLowerCase();


        // =====================================
        // CHECK EXISTING USER
        // =====================================

        const [exist] =
            await db.query(

                `
                SELECT id
                FROM users
                WHERE email = ?
                LIMIT 1
                `,

                [normalizedEmail]

            );


        if (exist.length > 0) {

            await logSecurityEvent({

                eventType:
                    "REGISTER_DUPLICATE_EMAIL",

                severity: "low",

                req,

                statusCode: 409,

                details: {
                    reason:
                        "Email already exists"
                }

            });


            return res.status(409).json({

                success: false,

                message:
                    "Email already exists"

            });

        }


        // =====================================
        // HASH PASSWORD
        // =====================================

        const hash =
            await bcrypt.hash(
                password,
                10
            );


        // =====================================
        // CREATE USER
        // =====================================

        const [result] =
            await db.query(

                `
                INSERT INTO users
                (
                    full_name,
                    email,
                    phone,
                    password,
                    role,
                    failed_login_attempts,
                    locked_until
                )
                VALUES (?, ?, ?, ?, 'user', 0, NULL)
                `,

                [
                    full_name,
                    normalizedEmail,
                    phone || null,
                    hash
                ]

            );


        // =====================================
        // SECURITY LOG
        // =====================================

        await logSecurityEvent({

            userId:
                result.insertId,

            eventType:
                "REGISTER_SUCCESS",

            severity: "low",

            req,

            statusCode: 201,

            details: {

                authProvider:
                    "password"

            }

        });


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(201).json({

            success: true,

            message:
                "Registration Successful",

            userId:
                result.insertId

        });

    }

    catch (err) {

        console.error(
            "Register Error:",
            err
        );


        await logSecurityEvent({

            eventType:
                "REGISTER_SERVER_ERROR",

            severity: "high",

            req,

            statusCode: 500,

            details: {

                reason:
                    "Unexpected registration server error"

            }

        });


        return res.status(500).json({

            success: false,

            message:
                "Registration failed"

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

        if (
            !email ||
            !password
        ) {

            await logSecurityEvent({

                eventType:
                    "LOGIN_VALIDATION_FAILED",

                severity: "low",

                req,

                statusCode: 400,

                details: {

                    reason:
                        "Email or password missing"

                }

            });


            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        // =====================================
        // NORMALIZE EMAIL
        // =====================================

        const normalizedEmail =
            String(email)
                .trim()
                .toLowerCase();


        // =====================================
        // FIND USER
        // =====================================

        const [users] =
            await db.query(

                `
                SELECT *
                FROM users
                WHERE email = ?
                LIMIT 1
                `,

                [normalizedEmail]

            );


        // =====================================
        // USER NOT FOUND
        // =====================================

        if (users.length === 0) {

            await logSecurityEvent({

                eventType:
                    "LOGIN_FAILED",

                severity: "medium",

                req,

                statusCode: 401,

                details: {

                    reason:
                        "User not found"

                }

            });


            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        const user = users[0];


        // =====================================
        // CHECK ACCOUNT LOCK
        // =====================================

        if (user.locked_until) {

            const lockedUntil =
                new Date(user.locked_until);

            const now =
                new Date();


            // =====================================
            // STILL LOCKED
            // =====================================

            if (lockedUntil > now) {

                const remainingSeconds =
                    Math.ceil(
                        (lockedUntil - now) / 1000
                    );

                const remainingMinutes =
                    Math.ceil(
                        remainingSeconds / 60
                    );


                await logSecurityEvent({

                    userId:
                        user.id,

                    eventType:
                        "LOGIN_BLOCKED_LOCKED",

                    severity: "high",

                    req,

                    statusCode: 429,

                    details: {

                        reason:
                            "Account temporarily locked",

                        remainingSeconds,

                        remainingMinutes

                    }

                });


                return res.status(429).json({

                    success: false,

                    message:
                        `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,

                    locked: true,

                    retryAfterSeconds:
                        remainingSeconds

                });

            }


            // =====================================
            // LOCK EXPIRED
            // =====================================

            await db.query(

                `
                UPDATE users
                SET
                    failed_login_attempts = 0,
                    locked_until = NULL
                WHERE id = ?
                `,

                [user.id]

            );

            user.failed_login_attempts = 0;
            user.locked_until = null;

        }


        // =====================================
        // GOOGLE-ONLY ACCOUNT
        // =====================================

        if (!user.password) {

            await logSecurityEvent({

                userId:
                    user.id,

                eventType:
                    "LOGIN_FAILED",

                severity: "low",

                req,

                statusCode: 401,

                details: {

                    reason:
                        "Password login attempted on Google account"

                }

            });


            return res.status(401).json({

                success: false,

                message:
                    "Please use Google login for this account"

            });

        }


        // =====================================
        // PASSWORD CHECK
        // =====================================

        const valid =
            await bcrypt.compare(

                password,

                user.password

            );


        // =====================================
        // WRONG PASSWORD
        // =====================================

        if (!valid) {

            // Current attempts
            const currentAttempts =
                Number(
                    user.failed_login_attempts || 0
                );

            // New attempt count
            const newAttempts =
                currentAttempts + 1;


            // =====================================
            // LOCK ACCOUNT AFTER 5 FAILURES
            // =====================================

            if (
                newAttempts >=
                MAX_LOGIN_ATTEMPTS
            ) {

                const lockedUntil =
                    new Date(
                        Date.now() +
                        LOCK_DURATION_MINUTES *
                        60 *
                        1000
                    );


                await db.query(

                    `
                    UPDATE users
                    SET
                        failed_login_attempts = ?,
                        locked_until = ?
                    WHERE id = ?
                    `,

                    [
                        newAttempts,
                        lockedUntil,
                        user.id
                    ]

                );


                // =====================================
                // LOGIN FAILED LOG
                // =====================================

                await logSecurityEvent({

                    userId:
                        user.id,

                    eventType:
                        "LOGIN_FAILED",

                    severity: "high",

                    req,

                    statusCode: 401,

                    details: {

                        reason:
                            "Wrong password",

                        failedAttempts:
                            newAttempts

                    }

                });


                // =====================================
                // ACCOUNT LOCK LOG
                // =====================================

                await logSecurityEvent({

                    userId:
                        user.id,

                    eventType:
                        "ACCOUNT_LOCKED",

                    severity: "critical",

                    req,

                    statusCode: 429,

                    details: {

                        reason:
                            "Maximum login attempts exceeded",

                        failedAttempts:
                            newAttempts,

                        lockDurationMinutes:
                            LOCK_DURATION_MINUTES

                    }

                });


                return res.status(429).json({

                    success: false,

                    message:
                        "Too many failed login attempts. Account locked for 5 minutes.",

                    locked: true,

                    retryAfterSeconds:
                        LOCK_DURATION_MINUTES * 60

                });

            }


            // =====================================
            // UPDATE FAILED ATTEMPTS
            // =====================================

            await db.query(

                `
                UPDATE users
                SET failed_login_attempts = ?
                WHERE id = ?
                `,

                [
                    newAttempts,
                    user.id
                ]

            );


            // =====================================
            // SECURITY LOG
            // =====================================

            await logSecurityEvent({

                userId:
                    user.id,

                eventType:
                    "LOGIN_FAILED",

                severity: "medium",

                req,

                statusCode: 401,

                details: {

                    reason:
                        "Wrong password",

                    failedAttempts:
                        newAttempts,

                    remainingAttempts:
                        MAX_LOGIN_ATTEMPTS -
                        newAttempts

                }

            });


            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password",

                remainingAttempts:
                    MAX_LOGIN_ATTEMPTS -
                    newAttempts

            });

        }


        // =====================================
        // SUCCESSFUL PASSWORD LOGIN
        // RESET SECURITY COUNTER
        // =====================================

        await db.query(

            `
            UPDATE users
            SET
                failed_login_attempts = 0,
                locked_until = NULL
            WHERE id = ?
            `,

            [user.id]

        );


        // =====================================
        // FIND OWNER BUSINESS
        // =====================================

        const [businesses] =
            await db.query(

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
        // SUCCESS LOGIN SECURITY LOG
        // =====================================

        await logSecurityEvent({

            userId:
                user.id,

            eventType:
                "LOGIN_SUCCESS",

            severity: "low",

            req,

            statusCode: 200,

            details: {

                authProvider:
                    "password"

            }

        });


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            token,

            user:
                formatUser(user),

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


        await logSecurityEvent({

            eventType:
                "LOGIN_SERVER_ERROR",

            severity: "high",

            req,

            statusCode: 500,

            details: {

                reason:
                    "Unexpected login server error"

            }

        });


        return res.status(500).json({

            success: false,

            message:
                "Login failed"

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

            await logSecurityEvent({

                eventType:
                    "GOOGLE_LOGIN_VALIDATION_FAILED",

                severity: "low",

                req,

                statusCode: 400,

                details: {

                    reason:
                        "Google token missing"

                }

            });


            return res.status(400).json({

                success: false,

                message:
                    "Google token is required"

            });

        }


        // =====================================
        // VERIFY FIREBASE TOKEN
        // =====================================

        const decodedToken =
            await firebaseAdmin.auth.verifyIdToken(
                idToken
            );


        // =====================================
        // GET GOOGLE DATA
        // =====================================

        const googleId =
            decodedToken.uid;

        const full_name =
            decodedToken.name || "";

        const email =
            decodedToken.email;

        const profile_image =
            decodedToken.picture || "";


        // =====================================
        // EMAIL CHECK
        // =====================================

        if (!email) {

            await logSecurityEvent({

                eventType:
                    "GOOGLE_LOGIN_FAILED",

                severity: "medium",

                req,

                statusCode: 400,

                details: {

                    reason:
                        "Google account email unavailable"

                }

            });


            return res.status(400).json({

                success: false,

                message:
                    "Google account email not available"

            });

        }


        // =====================================
        // NORMALIZE EMAIL
        // =====================================

        const normalizedEmail =
            String(email)
                .trim()
                .toLowerCase();


        // =====================================
        // FIND EXISTING USER
        // =====================================

        const [users] =
            await db.query(

                `
                SELECT *
                FROM users
                WHERE email = ?
                LIMIT 1
                `,

                [normalizedEmail]

            );


        let user;


        // =====================================
        // CREATE NEW GOOGLE USER
        // =====================================

        if (users.length === 0) {

            const [result] =
                await db.query(

                    `
                    INSERT INTO users
                    (
                        full_name,
                        email,
                        google_id,
                        profile_images,
                        auth_provider,
                        role,
                        failed_login_attempts,
                        locked_until
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        ?,
                        ?,
                        'google',
                        'user',
                        0,
                        NULL
                    )
                    `,

                    [
                        full_name,
                        normalizedEmail,
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


            user =
                newUsers[0];

        }


        // =====================================
        // EXISTING USER
        // =====================================

        else {

            user =
                users[0];


            await db.query(

                `
                UPDATE users
                SET
                    google_id = ?,
                    profile_images = ?,
                    auth_provider = 'google',
                    failed_login_attempts = 0,
                    locked_until = NULL
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


            user =
                updatedUsers[0];

        }


        // =====================================
        // FIND OWNER BUSINESS
        // =====================================

        const [businesses] =
            await db.query(

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
        // GOOGLE LOGIN SUCCESS LOG
        // =====================================

        await logSecurityEvent({

            userId:
                user.id,

            eventType:
                "LOGIN_SUCCESS",

            severity: "low",

            req,

            statusCode: 200,

            details: {

                authProvider:
                    "google"

            }

        });


        // =====================================
        // RESPONSE
        // =====================================

        return res.status(200).json({

            success: true,

            token,

            user:
                formatUser(user),

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


        await logSecurityEvent({

            eventType:
                "GOOGLE_LOGIN_FAILED",

            severity: "high",

            req,

            statusCode: 401,

            details: {

                reason:
                    "Invalid or failed Google authentication"

            }

        });


        return res.status(401).json({

            success: false,

            message:
                "Google authentication failed"

        });

    }

};