import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs"
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

export { registerUser };


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
