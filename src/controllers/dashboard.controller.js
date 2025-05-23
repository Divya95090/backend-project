import mongoose, { isValidObjectId } from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

// Importing necessary dependencies and utilities
const getChannelStats = asyncHandler(async (req, res) => {
    // Extract userId from request params and validate
    const { userId } = req.params;
    if (!(userId && isValidObjectId(userId))) {
        throw new ApiError(400, "UserId is invalid or missing");
    }

    // Count total videos owned by the user
    const totalVideos = await Video.countDocuments({ owner: userId });

    // Count total subscribers where this user is the channel
    const totalSubscribers = await Subscription.countDocuments({ channel: userId });

    // Aggregate total views and most viewed video
    const totalViewsAndMostViewed = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $sort: {
                views: -1
            }
        },
        {
            $group: {
                _id: null,
                mostView: { $max: "$views" },
                totalViews: { $sum: "$views" },
                mostViewedVideo: { $first: "$$ROOT" }
            }
        }
    ]);

    // Extract aggregated views data (in case no videos exist)
    const viewsData = totalViewsAndMostViewed[0] || {
        mostView: 0,
        totalViews: 0,
        mostViewedVideo: null
    };

    // Aggregate total likes on videos
    const likesPerVideo = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "videoLikes"
            }
        },
        {
            $addFields: {
                totalLikes: { $size: "$videoLikes" }
            }
        },
        {
            $project: {
                totalLikes: 1
            }
        }
    ]);

    // Aggregate total likes on tweets
    const likesPerTweet = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "tweetLikes"
            }
        },
        {
            $addFields: {
                totalLikes: { $size: "$tweetLikes" }
            }
        },
        {
            $project: {
                totalLikes: 1
            }
        }
    ]);

    // Aggregate total comments per video
    const commentsPerVideo = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "videoComments"
            }
        },
        {
            $addFields: {
                totalComments: { $size: "$videoComments" }
            }
        },
        {
            $project: {
                totalComments: 1
            }
        }
    ]);

    // Sum up total likes and comments from individual video/tweet stats
    const totalLikesOnVideo = likesPerVideo.reduce((acc, video) => acc + (video.totalLikes || 0), 0);
    const totalLikesOnTweet = likesPerTweet.reduce((acc, tweet) => acc + (tweet.totalLikes || 0), 0);
    const totalComments = commentsPerVideo.reduce((acc, video) => acc + (video.totalComments || 0), 0);

    // Send final JSON response
    return res.status(200).json(
        new ApiResponse(200, {
            totalVideos,
            totalSubscribers,
            totalViews: viewsData.totalViews,
            mostView: viewsData.mostView,
            mostViewedVideo: viewsData.mostViewedVideo,
            totalLikesOnVideo,
            totalLikesOnTweet,
            totalComments
        }, "Channel Stats fetched successfully")
    );
});



const getChannelVideos = asyncHandler(async (req, res) => {
    // Extract userId from the request parameters
    const { userId } = req.params;

    // Validate that the userId exists and is a valid MongoDB ObjectId
    if (!(userId && isValidObjectId(userId))) {
        throw new ApiError(400, "UserId is invalid or missing");
    }

    // Extract pagination and sorting options from query params, with defaults
    let { limit = 10, page = 1, sortBy = 'createdAt', sortType = 'desc' } = req.query;
    limit = parseInt(limit); // Ensure limit is a number
    page = parseInt(page);   // Ensure page is a number
    const skip = (page - 1) * limit; // Calculate how many documents to skip based on current page

    // First, count total videos uploaded by this user — needed for pagination info
    const totalVideos = await Video.countDocuments({ owner: userId });
    const totalPages = Math.ceil(totalVideos / limit); // Calculate total number of pages

    // Fetch videos using MongoDB aggregation pipeline
    const videos = await Video.aggregate([
        {
            // Stage 1: Filter videos owned by the given user
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // Stage 2: Sort videos based on the requested field and order
            $sort: {
                [sortBy]: sortType === "desc" ? -1 : 1 // Use -1 for descending, 1 for ascending
            }
        },
        {
            // Stage 3: Skip 'skip' number of documents for pagination
            $skip: skip
        },
        {
            // Stage 4: Limit the number of documents to return per page
            $limit: limit
        },
        {
            // Stage 5: Lookup owner (user) details from the users collection
            $lookup: {
                from: "users", // Collection to join with
                localField: "owner", // Field from videos
                foreignField: "_id", // Field from users
                as: "owner", // Output array field to place joined data in
                pipeline: [
                    {
                        // Only project selected user fields to avoid over fetching
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1,
                            coverImage: 1
                        }
                    }
                ]
            }
        },
        {
            // Stage 6 (optional): Convert owner array into an object for easier frontend use
            $unwind: "$owner"
        }
    ]);

    // If no videos found, return 404
    if (!videos || videos.length === 0) {
        throw new ApiError(404, "No Videos Found");
    }

    // Send response with videos, total count, pages, and current page
    return res.status(200).json(
        new ApiResponse(200, {
            videos,        // Array of video objects with owner data embedded
            totalVideos,   // Total videos uploaded by this channel
            totalPages,    // Total pages based on limit
            currentPage: page // Current requested page
        }, "Channel videos fetched successfully")
    );
});


export {
    getChannelStats, 
    getChannelVideos
    }