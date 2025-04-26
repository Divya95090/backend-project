import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs";
import jwt from "jsonwebtoken"


//just because we will need to create accessToken and refreshToken a lot of times we are making a general method to create them
const generateAccessAndRefreshTokens = async (userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        //we don't have password here so we do this saving 
        await user.save({validateBeforeSave: false})
        
        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating Access and Refresh Token")
    }
}


/*
🧠 Overview of the flow:
1️⃣ Extract user input from request body.
2️⃣ Validate required fields.
3️⃣ Check if a user already exists with the given email or username.
4️⃣ Handle avatar and cover image uploads (required/optional respectively).
5️⃣ Upload images to Cloudinary.
6️⃣ Create user in database.
7️⃣ Remove sensitive fields (like password) from response.
8️⃣ Send structured success response to the client.
*/

const registerUser = asyncHandler(async (req, res) => {

    // ✅ Step 1: Extract user details from incoming request
    // These are sent from the frontend in a form (form-data or JSON format)
    const { username, email, fullname, password } = req.body;

    // console.log("Email: ", email);
    // console.log("Password: ", password);
    // console.log("Fullname: ", fullname);
    // console.log("Username: ", username);

    /*
    ✅ Step 2: Input Validation
    - Ensure none of the required fields are empty or only whitespace.
    - The `.some()` method checks each field and returns true if any are invalid.
    - `field?.trim() === ""` checks for empty strings after trimming spaces.
    */
    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // 🔍 Additional validation (optional): Make sure email has a valid format
    // This is a basic check – for more robust validation, use regex or a validator library
    if (!email.includes('@')) {
        throw new ApiError(405, "Please enter a valid email address");
    }

    /*
    🔍 Step 3: Check for existing user in the database
    - Use MongoDB's `$or` operator to check if either the username or email already exists.
    - If such a user exists, we prevent duplicate account creation.
    */

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        // Cleanup local files if user already exists
    if (req.files?.avatar?.[0]?.path) {
            fs.unlinkSync(req.files.avatar[0].path);
        }
    if (req.files?.coverImage?.[0]?.path) {
            fs.unlinkSync(req.files.coverImage[0].path);
        }
    throw new ApiError(409, "User with email or username already exists");
    }
    // console.log(req.body);
    // console.log(req.files);
    
    
    /*
    🖼️ Step 4: Handle uploaded files using multer
    - `req.files` is populated by the multer middleware.
    - We expect two fields: avatar (required) and coverImage (optional).
    - Each of them is an array (because we may accept multiple files), so we access the first file's `.path`.
    */
    const avatarLocalPath = req.files?.avatar?.[0]?.path;// req.files comes from multer, this gives us the path where the avatar file is saved
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;// coverImage is optional

    // If avatar is missing, we throw an error – it's mandatory for profile setup.
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    /*
    ☁️ Step 5: Upload the images to Cloudinary
    - Cloudinary hosts the media and returns a secure URL.
    - `uploadOnCloudinary()` is a helper function that takes the local file path and uploads it.
    - If the upload fails, the local temp file is deleted.
    */
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath); // optional

    if (!avatar) {
        throw new ApiError(400, "Failed to upload avatar file");
    }

    /*
    🧱 Step 6: Create a new user entry in the database(we send objects)
    - We provide all required fields.
    - Password hashing happens in the user model using a pre-save hook.
    - Avatar and cover image fields store the Cloudinary URLs.
    - Username is stored in lowercase to ensure uniqueness consistency.
    */
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",  // if no coverImage, store empty string
        email,
        password,
        username: username.toLowerCase()
    });

    /*
    🔍 Step 7: Retrieve the created user from DB and remove sensitive fields
    - We use `.select()` with minus sign to exclude sensitive data like password and refreshToken.
    - This ensures we never accidentally send these values to the frontend.
    */
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    /*
    📦 Step 8: Send a structured success response using ApiResponse class
    - HTTP status code 201: "Created"
    - ApiResponse helps standardize how all responses look in the app.
    */
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully!")
    );

});


// 🌟 Controller to handle user login functionality

const loginUser = asyncHandler(async (req, res) => {

    /*
    🧠 TODOS for login flow:
    - Take input from user (username or email + password).
    - Check if the user exists in database.
    - If user doesn't exist ➔ throw error asking to register.
    - If user exists ➔ verify password.
    - If password is correct ➔ generate accessToken and refreshToken.
    - Send the tokens to frontend via cookies (secure, httpOnly).
    - Send user info and tokens in the response.
    */

    // 🛒 Step 1: Take input from the user (from request body)
    const { username, password, email } = req.body;

    // 🔍 Step 2: Validate input - Either username or email must be provided
    if (!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }

    // 🔎 Step 3: Search the user in the database by username OR email
    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    // 🛑 Step 4: If user is not found, throw error (User must register first)
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // 🔐 Step 5: Check if entered password is correct
    // `isPasswordCorrect` is a method inside user.model which uses bcrypt to compare password
    const isPasswordValid = await user.isPasswordCorrect(password);

    // 🛑 Step 6: If password is invalid, throw unauthorized error
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User Credentials");
    }

    // 🔥 Step 7: If password is correct, generate access and refresh tokens
    // These tokens are generated using the user's _id
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // 🧹 Step 8: Fetch fresh user details again, but exclude sensitive fields
    const LoggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    /*
    - We remove password and refreshToken before sending user data to the frontend for safety.
    - Only public safe data should be sent to frontend.
    */

    // 🍪 Step 9: Setup cookie options
    const options = {
        httpOnly: true, // 🛡️ Cookies cannot be accessed/modified by client side JavaScript (XSS protection)
        secure: true,   // 🛡️ Cookies will only be sent over HTTPS connections
        // (optional) You can add sameSite: 'Strict' or 'Lax' if you want more CSRF protection
    };

    // 🚀 Step 10: Send the response
    return res
        .status(200)
        // 🍪 Set accessToken and refreshToken as cookies
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: LoggedInUser, 
                    accessToken, 
                    refreshToken
                    /*
                    💬 Why sending accessToken and refreshToken in body too?
                    - If frontend developer wants, they can manually save tokens in localStorage/sessionStorage etc.
                    - (Depending on app security requirements.)
                    */
                },
                "User Logged In Successfully"
            )
        );
});

// 🌟 Controller to handle user logout functionality

const logoutUser = asyncHandler(async (req, res) => {
    /*
    🧠 TODOS for logout flow:
    - Remove user's refreshToken from database (important for security).
    - Clear accessToken and refreshToken cookies from browser.
    - Send a success response.
    */

    // 🛠️ Step 1: Find the user by ID (available in req.user) and remove their refreshToken from database
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined // ⛔ Setting refreshToken as undefined to invalidate it from server side
            }
        },
        {
            new: true // ✅ Ensures that the updated user object is returned (though we aren't using it here)
        }
    );

    // 🍪 Step 2: Define cookie clearing options
    const options = {
        httpOnly: true, // 🛡️ Prevents frontend JavaScript from accessing the cookies
        secure: true    // 🛡️ Ensures cookies are only sent over HTTPS
    };

    // 🚀 Step 3: Clear the cookies from browser and send response
    return res
        .status(200)
        .clearCookie("accessToken", options) // 🍪 Removing accessToken cookie
        .clearCookie("refreshToken", options) // 🍪 Removing refreshToken cookie
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        );
});


// Controller function to refresh the access token when the current one expires
const refreshAccessToken = asyncHandler(async (req, res) => {

    // Step 1️⃣: Extract the refreshToken from either cookies or request body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // Step 2️⃣: If no refresh token is provided, block the request
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request - No Refresh Token Provided")
    }

    try {
        // Step 3️⃣: Verify the incoming refresh token using REFRESH_TOKEN_SECRET
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        // Step 4️⃣: Find the user based on the decoded token's _id
        const user = await User.findById(decodedToken?._id)

        // Step 5️⃣: If no user is found, the token is invalid
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token - User not found")
        }

        // Step 6️⃣: Compare incoming refresh token with the one stored in the DB
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is Expired or Already Used")
        }

        // Step 7️⃣: Define secure cookie options
        const options = {
            httpOnly: true, // Cookie cannot be accessed by frontend JavaScript
            secure: true    // Cookie will only be sent over HTTPS
        }

        // Step 8️⃣: Generate new access and refresh tokens
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        // Step 9️⃣: Send the new tokens back to the client via cookies
        return res
            .status(200)
            .cookie("accessToken", accessToken, options) // Store new access token
            .cookie("refreshToken", newRefreshToken, options) // Store new refresh token
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        // Step 🔟: In case of any error (like token expiry or tampering), throw Unauthorized error
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }
})





export { registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
 };


//important note about file handling using multer 

/*
    ✅ How multer works:
    - Multer is a middleware that handles `multipart/form-data`, which is primarily used for file uploads.
    - We configured multer to save uploaded files into a temporary folder (`/public/temp`).
    - Multer adds a `files` object to the `req` (request) object.
    - For each file field in the form, multer stores metadata including the `path` to the saved file.

    Example:
    If frontend uploads two files with keys `avatar` and `coverImage`, the structure of `req.files` will be:
    req.files = {
        avatar: [ { path: "path/to/file1.jpg", originalname: "...", ... } ],
        coverImage: [ { path: "path/to/file2.jpg", originalname: "...", ... } ]
    }

    Since each field is an array (even if it contains one file), we access the first item using `[0]`.

    Then we use `.path` to get the local path of the uploaded file on the server.

    This file path is passed to Cloudinary uploader.
    */
