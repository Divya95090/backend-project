import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Tweet content is missing or empty");
    }

    const tweet = await Tweet.create({
        content: content.trim(),
        owner: req.user._id
    });

    if (!tweet) {
        throw new ApiError(500, "Failed to create tweet");
    }

    return res.status(201).json(
        new ApiResponse(201, tweet, "Tweet has been created successfully!")
    );
});


const getUserTweets = asyncHandler(async (req, res) => {
    // Extract userId from request parameters
    const { userId } = req.params;

    // Validate userId presence and its ObjectId format
    if (!(userId && isValidObjectId(userId))) {
        throw new ApiError(400, "UserID is either missing or is invalid");
    }

    // Fetch tweets using MongoDB Aggregation Pipeline
    const tweets = await Tweet.aggregate([
        {
            // Match only tweets that belong to the specified user
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // Lookup all likes associated with the tweet
            $lookup: {
                from: "likes", // Collection where likes are stored
                localField: "_id", // Tweet ID
                foreignField: "tweet", // Field in 'likes' referencing the tweet
                as: "tweetLikes" // Output array field for matched likes
            }
        },
        {
            // Lookup user details for the tweet owner
            $lookup: {
                from: "users", // Users collection
                localField: "owner", // Local field holding the owner's ObjectId
                foreignField: "_id", // Matching field in 'users'
                as: "owner", // Output array field
                pipeline: [
                    {
                        // Project only the required user fields
                        $project: {
                            avatar: 1,
                            username: 1
                        }
                    }
                ]
            }
        },
        {
            // Add computed fields to each tweet document
            $addFields: {
                likesCount: {
                    // Count the number of likes for this tweet
                    $size: "$tweetLikes"
                },
                owner: {
                    // Since lookup returns an array, extract the first object
                    $first: "$owner"
                }
            }
        }
        // Optionally, add $project here to limit final response fields if needed
    ]);

    // If aggregation returns no tweets, handle as an error
    if (!tweets) {
        throw new ApiError(400, "No tweets found");
    }

    // Send a structured response back to the client
    return res.status(200).json(
        new ApiResponse(200, tweets, "User Tweets have been fetched successfully!")
    );
});


const updateTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { tweetId } = req.params;

    if (!content?.trim() || !tweetId) {
        throw new ApiError(400, "Content or tweetId is missing");
    }

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const updatedTweet = await Tweet.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(tweetId),
            owner: new mongoose.Types.ObjectId(req.user._id)
        },
        {
            $set: {
                content: content?.trim()
            }
        },
        { new: true }
    );

    if (!updatedTweet) {
        throw new ApiError(403, "Tweet not found or you are not authorized to update it");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedTweet, "Tweet has been updated successfully!")
    );
});


const deleteTweet = asyncHandler(async (req, res) => {
    // TODO: Delete a tweet
    const { tweetId } = req.params;

    // ✅ Validate tweetId presence and format
    if (!(tweetId && isValidObjectId(tweetId))) {
        throw new ApiError(400, "Invalid tweetId or tweetId is missing");
    }

    // ✅ Find and delete the tweet that matches the given ID and belongs to the current user
    const tweet = await Tweet.findOneAndDelete(
        {
            _id: new mongoose.Types.ObjectId(tweetId), // Ensure tweetId is casted to ObjectId
            owner: new mongoose.Types.ObjectId(req.user._id) // Ensure ownership check
        }
    );

    // ✅ If no tweet was deleted, either it didn’t exist or wasn’t owned by the user
    if (!tweet) {
        throw new ApiError(400, "Error while deleting the tweet");
    }

    // ✅ Send a structured success response
    return res.status(200).json(
        new ApiResponse(200, tweet, "Tweet has been deleted successfully!")
    );
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}