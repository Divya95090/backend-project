import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Middleware to authenticate requests
import { upload } from "../middlewares/multer.middleware.js"; // Multer middleware to handle file uploads

const router = Router();

// 🔐 Apply JWT verification to all routes defined below.
// This ensures that only authenticated users can access video-related endpoints.
router.use(verifyJWT);

// 📥 GET: Fetch all videos (can include filters/pagination in controller)
// 📤 POST: Upload a new video (with video file and thumbnail image)
router
    .route("/")
    .get(getAllVideos)
    .post(
        // Use multer's `fields` to handle multiple file inputs: videoFile and thumbnail
        upload.fields([
            {
                name: "videoFile",  // Field name expected from frontend form
                maxCount: 1         // Only allow one video file per upload
            },
            {
                name: "thumbnail",  // Field name for thumbnail image
                maxCount: 1         // Only one thumbnail per video
            }
        ]),
        publishAVideo // Controller that processes the uploaded files and creates a new video document
    );

// 🔍 GET: Fetch a single video by its ID
// 🗑️ DELETE: Delete a video (only allowed by the owner or admin)
// 🔧 PATCH: Update video metadata or thumbnail (single file upload)
router
    .route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch(
        upload.single("thumbnail"), // Allow updating just the thumbnail
        updateVideo                 // Controller handles updating fields like title, description, etc.
    );

// 🔁 PATCH: Toggle the published/unpublished status of a video
// This can be useful for drafts or private videos
router
    .route("/toggle/publish/:videoId")
    .patch(togglePublishStatus);

export default router;
