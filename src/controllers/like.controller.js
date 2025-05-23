import {asyncHandler} from "../utils/asyncHandler.js";
import mongoose,{isValidObjectId} from "mongoose";
import { Like } from "../models/like.model.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse"
import {Video} from "../models/video.model.js"
import { Comment } from "../models/comment.model.js";


const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // Step 1: Validate input
    if (!videoId) {
        throw new ApiError(400, "VideoId is missing");
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoId");
    }

    // Step 2: Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found!");
    }

    // Step 3: Check if like already exists
    const existingLike = await Like.findOne({
        likedBy: req.user._id,
        video: videoId
    });

    let liked;

    if (!existingLike) {
        // Like the video
        await Like.create({
            video: videoId,
            likedBy: req.user._id
        });
        liked = true;
    } else {
        // Unlike the video
        await Like.findByIdAndDelete(existingLike._id);
        liked = false;
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            liked,
            `Video is ${liked ? "liked" : "disliked"}`
        )
    );
});


const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    // Step 1: Validate input
    if (!commentId) {
        throw new ApiError(400, "Comment ID is missing");
    }

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment Id");
    }
    
    // Step 2: Check if user already liked the comment
    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: req.user._id
    });

    let liked;

    if (!existingLike) {
        // Like the comment
        await Like.create({
            comment: commentId,
            likedBy: req.user._id
        });
        liked = true;
    } else {
        // Unlike the comment
        await Like.findByIdAndDelete(existingLike._id);
        liked = false;
    }

    // Step 3: Return response
    return res.status(200).json(
        new ApiResponse(
            200,
            liked,
            `Comment is ${liked ? "liked" : "disliked"}`
        )
    );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!tweetId) {
        throw new ApiError(400, "Tweet ID is missing");
    }

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID");
    }

    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    });

    let liked;
    if (!existingLike) {
        await Like.create({
            tweet: tweetId,
            likedBy: req.user?._id
        });
        liked = true;
    } else {
        await Like.findByIdAndDelete(existingLike._id);
        liked = false;
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            liked,
            `Tweet is ${liked ? "liked" : "disliked"}`
        )
    );
});


const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideos = await Like.aggregate([
        // Match only the likes where the current user has liked the video
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        // Lookup the actual video details from the 'videos' collection
        {
            $lookup: {
                from: "videos",
                localField: "video",         // field in 'likes'
                foreignField: "_id",         // field in 'videos'
                as: "likedVideos"            // the result will be placed in this array
            }
        },
        // Unwind the likedVideos array so we can work with each video individually
        {
            $unwind: "$likedVideos"
        },
        // Replace the root document with the video document (drop the like document structure)
        {
            $replaceRoot: {
                newRoot: "$likedVideos"
            }
        },
        // Lookup all likes on this video to calculate total likes and if current user liked it
        {
            $lookup: {
                from: "likes",
                localField: "_id",           // video ID
                foreignField: "video",       // likes referencing this video
                as: "likes"
            }
        },
        // Add calculated fields: total likes and isLiked status
        {
            $addFields: {
                likes: { $size: "$likes" },  // total number of likes on this video
                isLiked: {
                    // check if current user's ObjectId is in the array of likedBy fields
                    $in: [new mongoose.Types.ObjectId(req.user._id), "$likes.likedBy"]
                }
            }
        },
        // Lookup owner details of the video from the users collection
        {
            $lookup: {
                from: "users",
                localField: "owner",         // video.owner
                foreignField: "_id",         // users._id
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1       // only return required fields
                        }
                    }
                ]
            }
        },
        // Flatten owner array to a single object
        {
            $addFields: {
                owner: { $first: "$owner" }
            }
        }
    ]);
       
    // Return the final response
    return res.status(200).json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully!")
    );
});
