import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';

// 🔹 Create a schema instance using `Schema` from mongoose
const userSchema = new Schema({

    // 🧠 username field
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true, // if we want to make any field searchable in MongoDB (OPTIMIZED WAY)
    },

    // 🧠 email field
    email: {
        type: String,
        required: true,
        unique: true, // ensures no duplicate emails
        lowercase: true,
        trim: true,
    },

    // 🧠 full name field
    fullname: {
        type: String,
        required: true,
        trim: true,
        index: true, // makes searching users by full name faster
    },

    // 🧠 avatar (profile image)
    avatar: {
        type: String, // URL string (hosted on Cloudinary, AWS, etc.)
        required: true
    },

    // 🧠 cover image (optional banner)
    coverImage: {
        type: String, // optional field, can be left empty
    },

    // 🧠 watch history of videos
    watchHistory: [
        {
            type: Schema.Types.ObjectId, // array of ObjectIds (references Video model)
            ref: 'Video' // relation with another model
        }
    ],

    // 🧠 password (encrypted before storing)
    password: {
        type: String,
        required: [true, 'Password is required'] // custom error message if missing
    },

    // 🧠 refreshToken for authentication (optional)
    refreshToken: {
        type: String // used in JWT-based systems for refreshing access tokens
    }

}, { timestamps: true }) // Automatically creates 'createdAt' and 'updatedAt' fields



/*
 * 🔐 Pre-save hook:
 * Pre middleware functions are executed one after another, when each middleware calls next.
 * We're using the `pre("save")` hook to hash the password before saving the user to DB.
 * This ensures security because we never store plain-text passwords.
 */
userSchema.pre("save", async function (next) {
    // only hash if the password is new or changed
    if (!this.isModified("password")) return next();

    // bcrypt has a hash method which takes the value to encrypt and salt rounds as parameter
    this.password = await bcrypt.hash(this.password, 10); // 10 = salt rounds
    next(); // pass the control to the next middleware
});


// ✅ Method to compare plain password with hashed password from DB
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password); // returns boolean
};


/*
 * ✅ JWT generation methods:
 * JWTs (JSON Web Tokens) are used to verify user identity and keep them logged in.
 * We will be using both sessions and cookies in our app.
 * Access tokens are NOT stored in the DB, only sent to client and stored in memory/cookies.
 * Refresh tokens ARE stored in the DB for security and to control access.
 */

// Access tokens will have more information and are short-lived
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY } // typically short like "15m"
    );
};

// Refresh tokens have less information and are long-lived
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY } // typically long like "7d"
    );
};


// 🔹 Compile the schema into a model and export
export const User = mongoose.model('User', userSchema);



/*
🧾 FINAL NOTES:

- We will be using both sessions and cookies.
- Access token (short-lived) will not be stored in database.
- Refresh token (long-lived) will be stored in database.
- Refresh tokens contain less info than access tokens.
- Bcrypt is used to hash passwords securely — even if DB is compromised, passwords won’t be leaked.
- JWT tokens are bearer tokens: anyone having the token can access protected routes.
- Always use HTTP-only cookies for access token storage for security (prevents XSS attacks).
- Indexing fields like username/fullname improves query performance.
- Pre-save middleware ensures password is hashed before storing in MongoDB.
*/

