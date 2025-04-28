import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs";
import jwt from "jsonwebtoken"
import { subscribe } from "diagnostics_channel";
import mongoose from "mongoose";


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




// Controller to handle user password change functionality
const changeCurrentPassword = asyncHandler(async (req, res) => {

    // Step 1️⃣: Extract old and new passwords from the request body
    const { oldPassword, newPassword } = req.body 

    // Step 2️⃣: Find the currently logged-in user using their _id which we have set in verifyJWT middleware
    const user = await User.findById(req.user?._id);

    // Step 3️⃣: Validate if the old password entered by the user matches the existing password in the database
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    // Step 4️⃣: If the old password is incorrect, throw an error
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password")
    }

    // Step 5️⃣: If the old password is correct, update the user's password to the new password
    user.password = newPassword; // Setting the new password (will be hashed automatically via mongoose middleware)

    // Step 6️⃣: Save the updated user details
    // Passing validateBeforeSave: false to skip unnecessary validation checks like email format, etc.
    await user.save({ validateBeforeSave: false });

    // Step 7️⃣: Send a success response after password change
    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Password Changed Successfully")
        )
})


// Controller to fetch the currently logged-in user's details
const getCurrentUser = asyncHandler(async (req, res) => {

    // Step 1️⃣: Directly return the user object
    // The req.user object was set previously by the verifyJWT middleware after verifying the accessToken

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user, // Sending back the user details (without password and sensitive fields)
                "Current User Fetched Successfully" // Message indicating successful retrieval
            )
        )
})


// Controller to update current user's account details (like fullname and email)
const updateAccountDetails = asyncHandler(async (req, res) => {
    
    const { fullname, email } = req.body;

    // Step 1️⃣: Validate input - make sure at least one field is present
    if (!(fullname || email)) {
        throw new ApiError(400, "All fields are required!");
    }

    // Step 2️⃣: Update user details in the database
    const user = await User.findByIdAndUpdate(
        req.user?._id, // The ID is available in req.user because of verifyJWT middleware
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        { new: true } // By setting new: true, MongoDB returns the updated document instead of the old one
    )
    .select("-password"); // Step 3️⃣: We don't want to expose the password field in the response

    // Step 4️⃣: Check if user was found and updated
    if (!user) {
        throw new ApiError(400, "Invalid Credentials");
    }

    // Step 5️⃣: Send success response with updated user info
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user, // returning updated user (without password)
                "Account Details Updated Successfully" // Success message
            )
        );
});

// Controller to update user's avatar image
const updateUserAvatar = asyncHandler(async (req, res) => {

    // Step 1️⃣: Get the uploaded avatar file's local path from multer's processed file
    const avatarLocalPath = req.file?.path;

    // Step 2️⃣: Check if the file is actually uploaded
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    // Step 3️⃣: Upload the avatar to Cloudinary (or any cloud storage you're using)
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    // Step 4️⃣: Validate upload success - make sure Cloudinary returned a URL
    if (!avatar?.url) {
        throw new ApiError(400, "Error while uploading avatar");
    }

    // Step 5️⃣: Update the user's avatar field in the database with the new Cloudinary URL
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id, // user's ID from the verifyJWT middleware
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true } // return the updated document
    ).select("-password"); // Step 6️⃣: Don't send password back in the response

    // Step 7️⃣: Send success response
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser, // optional: you can also send updated user info
                "Avatar Updated Successfully" // Success message
            )
        );
});

// Controller to update user's cover image
const updateUserCoverImage = asyncHandler(async (req, res) => {

    // Step 1️⃣: Get the uploaded cover image's local path from multer's processed file
    const coverImageLocalPath = req.file?.path;

    // Step 2️⃣: Check if the cover image file is actually uploaded
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing");
    }

    // Step 3️⃣: Upload the cover image to Cloudinary (or any cloud storage)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // Step 4️⃣: Validate upload success - make sure Cloudinary returned a URL
    if (!coverImage?.url) {
        throw new ApiError(400, "Error while uploading Cover Image");
    }

    // Step 5️⃣: Update the user's coverImage field in the database with the new Cloudinary URL
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id, // user's ID coming from verifyJWT middleware
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true } // return the updated document after setting new cover image
    ).select("-password"); // Step 6️⃣: Exclude password from the response

    // Step 7️⃣: Send success response
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedUser, // sending the updated user object
                "Cover Image updated Successfully" // Success message
            )
        );
});


// Controller to get a User's Channel Profile using username
const getUserChannelProfile = asyncHandler(async (req, res) => {
    
    // Step 1️⃣: Extract the username from route params (URL)
    const { username } = req.params; // We use params here because username is a part of the URL

    // Step 2️⃣: Validate if username exists
    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    // Step 3️⃣: Use MongoDB aggregation pipeline to fetch the user's channel profile
    const channel = await User.aggregate([
        
        // Stage 1: $match
        // ➔ Filter the User document where the username matches (after converting to lowercase)
        {
            $match: {
                username: username?.toLowerCase()
            }
        },

        // Stage 2: $lookup for Subscribers
        // ➔ Look into 'subscriptions' collection where 'channel' field matches user's _id
        // ➔ This tells how many people have subscribed to this user
        {
            $lookup: {
                from: "subscriptions", // collection we are joining with
                localField: "_id",      // user's _id
                foreignField: "channel", // match where 'channel' field of subscriptions equals user's _id
                as: "subscribers"       // output array will be stored here
            }
        },

        // Stage 3: $lookup for Subscribed To
        // ➔ Look into 'subscriptions' where 'subscriber' field matches user's _id
        // ➔ This tells how many channels this user has subscribed to
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },

        // Stage 4: $addFields
        // ➔ Dynamically add new fields:
        //    - subscribersCount: total number of subscribers
        //    - channelsSubscribedToCount: total number of channels the user has subscribed to
        //    - isSubscribed: to check if the currently logged-in user has subscribed to this channel
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers" // counts number of documents in subscribers array
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo" // counts number of documents in subscribedTo array
                },
                isSubscribed: {
                    $cond: { // Conditional Operator: if-then-else
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] }, 
                        // Check if currently logged-in user's id exists inside subscribers' subscriber field
                        then: true, // if yes ➔ true
                        else: false // if no ➔ false
                    }
                }
            }
        },

        // Stage 5: $project
        // ➔ Only select specific fields to return in final response (avoid sending entire user document)
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]); // After aggregation pipelines, we get an array

    // Step 4️⃣: Handle if no channel is found (empty array)
    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    // Step 5️⃣: Return Success Response
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0], // Send only the first object from array
                "User channel fetched Successfully"
            )
        );
});
/*
Aggregation pipelines always return an array, even if 1 document matches.

Always validate .length on aggregation outputs.

$cond and $in are very powerful for relational logic inside MongoDB without fetching multiple times.

Using $size inside $addFields is the best way to count related documents easily.
*/

const getCurrentUserWatchHistory = asyncHandler(async (req, res) => {

    // we are creating an aggregation pipeline on the User model
    const user = await User.aggregate([
        {
            // first, we are filtering (matching) the currently logged-in user based on _id
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) // converting _id to ObjectId explicitly to avoid type mismatch
            }
        },
        {
            // now we are doing a LEFT JOIN (using $lookup) with the videos collection
            $lookup: {
                from: "videos", // the collection we want to join with (videos)
                localField: "watchHistory", // the field in the User document (watchHistory array of ObjectIds)
                foreignField: "_id", // the field in the Video document (_id)
                as: "watchHistory", // the name of the new array where joined video documents will be stored
                pipeline: [ // processing each joined video document separately

                    // for each video, we also want the owner information (the creator of the video)
                    {
                        $lookup: {
                            from: "users", // the users collection (to fetch owner details)
                            localField: "owner", // the owner field in the video document (owner id)
                            foreignField: "_id", // matching it with _id in users
                            as: "owner", // store the joined owner data in owner array
                            pipeline:[ // inside this lookup, we use a pipeline to project specific fields
                                {
                                    $project:{
                                        fullname: 1, // only take fullname
                                        username: 1, // only take username
                                        avatar: 1    // only take avatar
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // now, owner is an array (because of $lookup) but we want it as a single object
                        // so we use $addFields to convert owner array to a single owner object
                        $addFields:{
                            owner: {
                                $first: "$owner" // taking the first (and only) element
                            }
                        }
                    }
                ]
            }
        }
    ]);

    // now sending the final watchHistory array as response
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0]?.watchHistory, // watchHistory of the current user
            "Watch History Fetched Successfully"
        )
    );

});

  



export { registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getCurrentUserWatchHistory
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
