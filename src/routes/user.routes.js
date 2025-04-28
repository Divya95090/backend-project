import { Router } from "express";
import { 
    changeCurrentPassword, 
    getCurrentUser, 
    getCurrentUserWatchHistory, 
    getUserChannelProfile, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    registerUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage 
} from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

/*
📌 About This Route File

✅ Purpose:
- Manages all user-related API endpoints like registration, login, profile update, password change, watch history, etc.

✅ Middlewares Used:
- `upload`: For parsing multipart/form-data (image uploads).
- `verifyJWT`: To protect private routes by verifying user's JWT token.

✅ Controllers Used:
- Each route calls a specific function from `user.controller.js` to handle the business logic.
*/

/*
=====================================
    Public Routes
=====================================
*/

/*
🔵 Register User
✅ Route: POST /api/v1/users/register
✅ Fields Expected:
   - avatar (required) [image]
   - coverImage (optional) [image]
✅ Working:
   - `upload.fields()` parses incoming avatar and coverImage files.
   - Then `registerUser` handles:
     ➔ Validation of user details.
     ➔ Uploads avatar/coverImage to Cloudinary.
     ➔ Creates user in the database.
*/
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
);

/*
🔵 Login User
✅ Route: POST /api/v1/users/login
✅ Fields Expected:
   - email
   - password
✅ Working:
   - `loginUser` verifies credentials.
   - If correct, generates access and refresh tokens.
   - Tokens are set as secure HttpOnly cookies.
*/
router.route("/login").post(loginUser);

/*
🔵 Refresh Access Token
✅ Route: POST /api/v1/users/refresh-token
✅ Working:
   - `refreshAccessToken` checks if a valid refreshToken exists (cookie/body).
   - If valid, it generates a new accessToken and refreshToken.
   - Useful for session continuation without forcing user to login again.
*/
router.route("/refresh-token").post(refreshAccessToken);

/*
=====================================
    Protected Routes (JWT Required)
=====================================
*/

/*
🟢 Logout User
✅ Route: POST /api/v1/users/logout
✅ Working:
   - `verifyJWT` ensures user is logged in.
   - `logoutUser` clears the user's cookies and invalidates refresh token.
*/
router.route("/logout").post(verifyJWT, logoutUser);

/*
🟢 Change Current Password
✅ Route: POST /api/v1/users/change-password
✅ Fields Expected:
   - oldPassword
   - newPassword
✅ Working:
   - `verifyJWT` ensures user is authenticated.
   - `changeCurrentPassword` checks old password.
   - If correct, sets new password after validation.
*/
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

/*
🟢 Get Current Logged-in User Info
✅ Route: GET /api/v1/users/current-user
✅ Working:
   - `verifyJWT` verifies user session.
   - `getCurrentUser` simply fetches and returns current user's basic info.
*/
router.route("/current-user").get(verifyJWT, getCurrentUser);

/*
🟢 Update Account Details (fullname, email)
✅ Route: PATCH /api/v1/users/updateAccount
✅ Fields Expected:
   - fullname (optional)
   - email (optional)
✅ Working:
   - `verifyJWT` ensures the request is made by logged-in user.
   - `updateAccountDetails` updates fullname/email in the database.
*/
router.route("/updateAccount").patch(verifyJWT, updateAccountDetails);

/*
🟢 Update User Avatar
✅ Route: PATCH /api/v1/users/avatar
✅ Fields Expected:
   - avatar [image file]
✅ Working:
   - `verifyJWT` protects the route.
   - `upload.single("avatar")` processes the image.
   - `updateUserAvatar` uploads new avatar to Cloudinary and updates user's profile.
*/
router.route("/avatar").patch(
    verifyJWT,
    upload.single("avatar"),
    updateUserAvatar
);

/*
🟢 Update User Cover Image
✅ Route: PATCH /api/v1/users/cover-image
✅ Fields Expected:
   - coverImage [image file]
✅ Working:
   - `verifyJWT` protects the route.
   - `upload.single("coverImage")` processes the image.
   - `updateUserCoverImage` uploads new cover image to Cloudinary and updates user's profile.
*/
router.route("/cover-image").patch(
    verifyJWT,
    upload.single("coverImage"),
    updateUserCoverImage
);

/*
🟢 Get Another User's Channel Profile by Username
✅ Route: GET /api/v1/users/c/:username
✅ Working:
   - `verifyJWT` ensures request is from a logged-in user.
   - `getUserChannelProfile` aggregates user info:
       ➔ Finds user by username.
       ➔ Joins subscriptions (followers/following count).
       ➔ Checks if the current user is already subscribed.
*/
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);

/*
🟢 Get Current User's Watch History
✅ Route: GET /api/v1/users/history
✅ Working:
   - `verifyJWT` ensures logged-in access.
   - `getCurrentUserWatchHistory` aggregates:
       ➔ Fetch user's watch history.
       ➔ Populates videos and their respective owner details.
*/
router.route("/history").get(verifyJWT, getCurrentUserWatchHistory);

export default router;
