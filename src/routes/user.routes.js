import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

/*
📌 About This Route

✅ Route: POST /api/v1/users/register

✅ Purpose:
- Handle user registration along with avatar and cover image uploads.

✅ How it works:
1️⃣ Middleware `upload.fields()` handles multipart/form-data (file uploads).
2️⃣ Expect two fields:
   - `avatar`: Required, maximum 1 file.
   - `coverImage`: Optional, maximum 1 file.
3️⃣ After successful file parsing, control passes to `registerUser` controller.

✅ Tech involved:
- Multer middleware: Handles file parsing and temporary storage.
- Controller `registerUser`: Handles validation, cloud uploads, database entry, and response.

*/

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]), // 🎯 Enables image uploads via form-data fields
    registerUser // 🎯 Handles registration logic after files are parsed
);

router.route("/login").post(loginUser)


//secured routes
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)

export default router;


