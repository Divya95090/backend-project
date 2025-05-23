import {asyncHandler} from "../utils/asyncHandler.js"
import mongoose, { isValidObjectId } from "mongoose"
import {ApiResponse} from "../utils/ApiResponse.js"
import {ApiError} from "../utils/ApiError.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"


const getAllVideos = asyncHandler(async (req, res) => {
    /*
    ✅ Purpose: Fetch all videos uploaded by a user based on search query, pagination, and sorting
    ✅ Query Params:
       - userId: (required) ID of the user whose videos to fetch
       - query: (required) search term to match in title or description
       - page: (optional) current page number (default: 1)
       - limit: (optional) videos per page (default: 10)
       - sortBy: (optional) field to sort (default: createdAt)
       - sortType: (optional) asc/desc (default: desc)
    */

    const {
        page = 1,
        limit = 10,
        query,
        sortBy = "createdAt",
        sortType = "desc",
        userId
    } = req.query;

    // ✅ Validate userId
    if (!(userId && mongoose.isValidObjectId(userId))) {
        throw new ApiError(400, "userId is missing or incorrect");
    }

    // ✅ Validate search query
    if (!query) {
        throw new ApiError(400, "Query not found!");
    }

    // ✅ Check if user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(400, "User not found");
    }

    const videos = await Video.aggregate([
        /*
        🔍 Match videos based on:
        - owner ID
        - search query in title or description (case-insensitive)
        */
        {
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } },
                ],
                owner: new mongoose.Types.ObjectId(userId)
            }
        },

        /*
        ❤️ Lookup likes for each video
        */
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },

        /*
        ➕ Add total like count
        */
        {
            $addFields: {
                likes: { $size: "$likes" }
            }
        },

        /*
        👤 Lookup owner details (fetch only required fields)
        */
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },

        /*
        📦 Since lookup returns array, we unwind to get plain object
        */
        { $unwind: "$ownerDetails" },

        /*
        🔽 Sort videos
        */
        {
            $sort: {
                [sortBy]: sortType === "desc" ? -1 : 1
            }
        },

        /*
        📄 Pagination
        */
        {
            $skip: (Number(page) - 1) * Number(limit)
        },
        {
            $limit: Number(limit)
        },

        /*
        🧾 Project final shape of response
        */
        {
            $project: {
                title: 1,
                description: 1,
                videoFile: 1,
                thumbnail: 1,
                likes: 1,
                views: 1,
                ownerDetails: 1,
                createdAt: 1,
                updatedAt: 1 
            }
        }
    ]);

    
    if (!videos.length) {
        throw new ApiError(404, "No videos found");
    }

    
    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    /*
    ✅ STEP 1: Validate required text fields
    We need both title and description to create a meaningful video entry.
    */
    if (!(title && description)) {
        throw new ApiError(400, "No title and description provided!!");
    }

    /*
    ✅ STEP 2: Extract uploaded file paths
    We're using Multer middleware with `upload.fields()` so the files are available in `req.files`.
    Each field is an array (even if it contains one file), hence we access `[0].path`.
    */
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!(videoFileLocalPath && thumbnailLocalPath)) {
        throw new ApiError(400, "Video or thumbnail file is missing");
    }

    /*
    ✅ STEP 3: Upload files to Cloudinary
    This converts the local file path to a hosted URL via the Cloudinary service.
    */
    const video = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    // 🛑 Check upload success
    if (!video?.url) {
        throw new ApiError(500, "Error while uploading Video file");
    }

    if (!thumbnail?.url) {
        throw new ApiError(500, "Error while uploading Thumbnail");
    }

    /*
    ✅ STEP 4: Create the video document in MongoDB
    We use the model `Video` to create a new document with all required info.
    - `owner` is set from the logged-in user (available in `req.user`)
    - `duration` comes from Cloudinary's response
    */
    const publishedVideo = await Video.create({
        title,
        description,
        videoFile: video.url,
        thumbnail: thumbnail.url,
        owner: req.user?._id,
        duration: video?.duration || 0
    });

    // 🛑 Handle case where document creation fails
    if (!publishedVideo) {
        throw new ApiError(500, "Failed to Publish Video");
    }

    /*
    ✅ STEP 5: Send success response
    Wrap the result in a standardized `ApiResponse` class.
    */
    return res.status(200).json(
        new ApiResponse(200, publishedVideo, "Video Published Successfully!")
    );
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    /*
    ✅ STEP 1: Validate video ID
    Use Mongoose's isValidObjectId to ensure it's a proper ObjectId
    */
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "VideoId is missing or invalid");
    }

    /*
    ✅ STEP 2: Fetch video using aggregation
    - Use $lookup to join with likes and users collections
    - Compute like count and whether current user liked the video
    */
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likes: { $size: "$likes" },  // Total like count
                owner: { $first: "$owner" }, // Get single user object
                // Check if current user has liked the video
                isLiked: {
                    $cond: {
                        if: {
                            $in: [
                                new mongoose.Types.ObjectId(req.user._id),
                                "$likes.likedBy"
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                owner: 1,
                isLiked: 1,
                likes: 1,
                views: 1
            }
        }
    ]);

    /*
    ✅ STEP 3: Increment view count in background
    */
    await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: { views: 1 }
        },
        { new: true }
    );

    /*
    ✅ STEP 4: Handle case where video doesn't exist
    `aggregate()` returns an array, so check length
    */
    if (!video.length) {
        throw new ApiError(404, "Video not found");
    }

    /*
    ✅ STEP 5: Send response
    Return first (and only) result from aggregate
    */
    return res.status(200).json(
        new ApiResponse(200, video[0], "Video Fetched Successfully")
    );
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    /*
    ✅ STEP 1: Validate videoId (presence and ObjectId format)
    */
    if (!videoId?.trim()) {
        throw new ApiError(400, "VideoId is missing");
    }
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoId");
    }

    /*
    ✅ STEP 2: Validate title and description
    */
    if (!(title && description)) {
        throw new ApiError(400, "Title or description is missing");
    }

    /*
    ✅ STEP 3: Get and upload new thumbnail if provided
    - Only proceed if a thumbnail file was sent
    */
    const localThumbnailPath = req.files?.thumbnail?.[0]?.path;
    if (!localThumbnailPath) {
        throw new ApiError(400, "Thumbnail file doesn't exist!");
    }

    const thumbnail = await uploadOnCloudinary(localThumbnailPath);
    if (!thumbnail?.url) {
        throw new ApiError(500, "Failed to upload thumbnail");
    }

    /*
    ✅ STEP 4: Update video in DB
    - $set only updates the specific fields
    - new: true returns the updated document
    */
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: thumbnail.url
            }
        },
        { new: true }
    );

    /*
    ✅ STEP 5: Check if update succeeded
    */
    if (!updatedVideo) {
        throw new ApiError(404, "Video not updated");
    }

    /*
    ✅ STEP 6: Return success response
    */
    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video details updated successfully!")
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    /*
    ✅ STEP 1: Validate presence and format of videoId
    */
    if (!videoId) {
        throw new ApiError(400, "VideoId is missing");
    }
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    /*
    ✅ STEP 2: Attempt to delete the video
    - Only deletes if the logged-in user is the owner
    */
    const video = await Video.findOneAndDelete({
        _id: mongoose.Types.ObjectId(videoId),
        owner: req.user._id // Ensures users can only delete their own videos
    });

    /*
    ✅ STEP 3: If no video was found/deleted, send error
    */
    if (!video) {
        throw new ApiError(404, "Video not found or not authorized to delete");
    }

    /*
    ✅ STEP 4: Return success response
    */
    return res.status(200).json(
        new ApiResponse(200, video, "Video deleted successfully!")
    );
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    /*
    ✅ STEP 1: Validate the presence and validity of videoId
    */
    if (!videoId) {
        throw new ApiError(400, "VideoId is missing");
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoId");
    }

    /*
    ✅ STEP 2: Fetch the video owned by the current user
    - Only allow the owner to toggle publish status
    - Only select the 'isPublished' field to keep query light
    */
    const video = await Video.findOne({
        _id: videoId,
        owner: req.user?._id
    }).select("isPublished");

    if (!video) {
        throw new ApiError(404, "Video not found or not authorized");
    }

    /*
    ✅ STEP 3: Toggle isPublished field
    */
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(400, "Video status could not be updated");
    }

    /*
    ✅ STEP 4: Send response with new status
    */
    return res.status(200).json(
        new ApiResponse(
            200,
            updatedVideo.isPublished,
            "Publish status toggled successfully!"
        )
    );
});


export {
    getAllVideos,
    getVideoById,
    togglePublishStatus,
    deleteVideo,
    updateVideo,
    publishAVideo
}




