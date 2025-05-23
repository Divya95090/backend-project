import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    // Extract videoId from request parameters and pagination options from query
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate videoId
    if (!(videoId && isValidObjectId(videoId))) {
        throw new ApiError(400, "VideoId is missing or incorrect");
    }

    const comments = await Comment.aggregate([
        // Match only comments belonging to the specified video
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        // Apply pagination: skip documents for previous pages
        {
            $skip: (Number(page) - 1) * Number(limit)
        },
        // Limit the number of documents to the specified limit
        {
            $limit: Number(limit)
        },
        // Project only necessary fields: content and owner
        {
            $project: {
                content: 1,
                owner: 1
            }
        },
        // Lookup user details (username, avatar) for each comment's owner
        {
            $lookup: {
                from: "users", // lookup from users collection
                localField: "owner", // owner in Comment
                foreignField: "_id", // match with _id in User
                as: "owner", // result as 'owner' array
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
        // Lookup likes for each comment
        {
            $lookup: {
                from: "likes", // lookup from likes collection
                localField: "_id", // comment _id
                foreignField: "comment", // likes with comment ref
                as: "likes"
            }
        },
        // Add fields: total number of likes and flatten owner array to object
        {
            $addFields: {
                likesCount: {
                    $size: "$likes" // count likes array size
                },
                owner: {
                    $arrayElemAt: ["$owner", 0] // extract first element from 'owner' array
                }
            }
        },
        // Final projection: send only required fields in response
        {
            $project: {
                content: 1,
                owner: 1,
                likesCount: 1
            }
        }
    ]);

    // If no comments found, return error
    if (!comments) {
        throw new ApiError("No comments Found");
    }

    // Send successful response
    return res.status(200).json(
        new ApiResponse(200, comments, "Video Comments are fetched Successfully!")
    );
});


const addComment = asyncHandler(async (req, res) => {
    // Extract content from body and videoId from route params
    const { content } = req.body;
    const { videoId } = req.params;

    // Validate presence of content and videoId
    if (!(content && videoId)) {
        throw new ApiError(400, "Content or videoId is missing");
    }

    // Validate videoId format
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoId");
    }

    // Create a new comment in the Comment collection
    const comment = await Comment.create({
        content,             // Text content of the comment
        video: videoId,      // Reference to the video being commented on
        owner: req.user._id  // User ID of the commenter (assumes authentication middleware set req.user)
    });

    // If comment creation fails, throw an error
    if (!comment) {
        throw new ApiError(400, "No comment has been added");
    }

    // Return a success response with the newly created comment
    return res.status(200).json(
        new ApiResponse(200, comment, "Comment has been added successfully!")
    );
});


const updateComment = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { videoId, commentId } = req.params;

    if (!(content && videoId && commentId)) {
        throw new ApiError(400, "Content, videoId or commentId is missing");
    }

    if (!isValidObjectId(videoId) || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid videoId or commentId");
    }

    // Only update if the logged-in user is the owner
    const updatedComment = await Comment.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(commentId),
            video: new mongoose.Types.ObjectId(videoId),
            owner: req.user._id // secure update
        },
        {
            $set: { content }
        },
        { new: true }
    );

    if (!updatedComment) {
        throw new ApiError(403, "Comment not found or you are not authorized to update it");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedComment, "Comment has been updated successfully!")
    );
});


const deleteComment = asyncHandler(async (req, res) => {
    const { commentId, videoId } = req.params;

    if (!(commentId && videoId)) {
        throw new ApiError(400, "commentId or videoId is missing");
    }

    if (!isValidObjectId(commentId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Either commentId or videoId is invalid");
    }

    const deletedComment = await Comment.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(commentId),
        video: new mongoose.Types.ObjectId(videoId),
        owner: new mongoose.Types.ObjectId(req.user._id)
    });

    if (!deletedComment) {
        throw new ApiError(403, "Comment not found or you are not authorized to delete it");
    }

    return res.status(200).json(
        new ApiResponse(200, deletedComment, "Comment has been deleted from video successfully")
    );
});


export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }