// 🛡️ Middleware to verify that the user is authenticated (token is valid)

// 📦 Import necessary utilities
import { ApiError } from "../utils/ApiError.js"; 
import jwt from "jsonwebtoken"; 
import { asyncHandler } from "../utils/asyncHandler.js"; 
import { User } from "../models/user.model.js"; 

/*
🧠 Purpose of this middleware:
- It ensures that only authenticated users can access protected routes.
- It verifies the JWT token sent by the client.
- If the token is valid, it attaches the user object to `req.user`.
- If the token is invalid or missing, it throws an Unauthorized error.
*/

export const verifyJWT = asyncHandler(async (req, res, next) => {
// sometimes what happens we dont use res so we replace it by "_"(underscore)
    /*
    🔐 How JWT token is sent from frontend:
    - Whenever the user wants to access a protected route or resource, the client should send the JWT token.
    - Usually sent inside the Authorization header like:
          Authorization: Bearer <token>
    - Alternatively, we can also use cookies to send tokens.

    ✅ Cookie Parser:
    - We have access to cookies here because we are using `cookie-parser` middleware in `app.js`.
    */


    try {
        // 🧹 Step 1: Extract token either from cookies or Authorization header
        const token = req.cookies?.accessToken 
                      || req.header("Authorization")?.replace("Bearer ", "");

        // 🛑 Step 2: If no token is found, block the request
        if (!token) {
            throw new ApiError(401, "Unauthorized Request");
        }

        // 🔍 Step 3: Verify the token using jwt and secret key
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        /*
        - `decodedToken` contains the payload we added when signing the token.
        - In our case, it contains at least the user's `_id`.
        */

        // 🧹 Step 4: Find the user in the database using the decoded _id
        const user = await User.findById(decodedToken?._id)
                               .select("-password -refreshToken"); 
        // We exclude sensitive fields like password and refreshToken

        // 🛑 Step 5: If user not found, throw an error
        if (!user) {
            // ⚡ (TODO: Discuss about handling token invalidation on frontend side)
            throw new ApiError(401, "Invalid Access Token");
        }

        // ✅ Step 6: Attach the user object to request so that next middleware/controller can access it
        req.user = user;

        // 🎯 Step 7: Move to the next middleware/controller
        next();

    } catch (error) {
        // 🛑 In case of any failure (token invalid, expired, tampered), throw Unauthorized error
        throw new ApiError(401, error?.message || "Invalid Access Token");
    }
});


// 🧠 Frontend strategy when 401 Unauthorized error occurs:

// ➔ If a 401 (Unauthorized) error is received from the backend,
//    the frontend developer can write a small additional logic:
// 
//    - On receiving 401, automatically trigger an API call to the "refresh token" endpoint.
//    - In this request, send the refreshToken (which is usually stored securely in cookies).
//
// ➔ Backend will then:
//    - Validate the refreshToken.
//    - If the refreshToken is valid and matches the user session,
//      generate a new accessToken (and optionally a new refreshToken).
//    - Start the session again seamlessly without forcing the user to log in again.
//
// 🔄 This mechanism ensures a smooth experience by silently refreshing tokens in the background
//    and only logging the user out if the refreshToken itself is invalid or expired.
