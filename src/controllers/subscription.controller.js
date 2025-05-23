import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // ✅ Step 1: Validate if channelId is present
    if (!channelId) {
        throw new ApiError(400, "Channel ID is required");
    }

    // ✅ Step 2: Get the currently logged-in user (from JWT middleware)
    const user = req.user;

    // ✅ Step 3: Check if the subscription already exists
    const existingSubscription = await Subscription.findOne({
        channel: new mongoose.Types.ObjectId(channelId),
        subscriber: user._id
    });

    if (existingSubscription) {
        // 🗑️ Already subscribed: perform "unsubscribe"
        await Subscription.deleteOne({
            channel: new mongoose.Types.ObjectId(channelId),
            subscriber: user._id
        });

        return res.status(200).json(
            new ApiResponse(200, {}, "Unsubscribed successfully")
        );
    } else {
        // ➕ Not subscribed: perform "subscribe"
        await Subscription.create({
            channel: new mongoose.Types.ObjectId(channelId),
            subscriber: user._id
        });

        return res.status(200).json(
            new ApiResponse(200, {}, "Subscribed successfully")
        );
    }
});


// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // ✅ Step 1: Validate channelId
    if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid or missing channel ID");
    }

    // ✅ Step 2: Query all subscriptions where the channel matches channelId
    const subscribers = await Subscription.find({
        channel: new mongoose.Types.ObjectId(channelId)
    });

    // ✅ Step 3: Return count of subscribers
    return res.status(200).json(
        new ApiResponse(
            200,
            { subscriberCount: subscribers?.length || 0 },
            "Successfully fetched the number of subscribers for this channel."
        )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // ✅ Step 1: Validate channelId
    if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid or missing channel ID");
    }

    // ✅ Step 2: Find all subscriptions where the user (subscriber) is subscribed to other channels
    // Populate the 'channel' field with specific fields to return minimal but useful data
    const subscribedTo = await Subscription.find({ subscriber: channelId })
        .populate("channel", ["_id", "avatar", "username", "fullname"]);

    // ✅ Step 3: If somehow no result (rare for Mongoose .find), throw server error
    if (!subscribedTo) {
        throw new ApiError(500, "Server error while fetching subscriptions");
    }

    // ✅ Step 4: Return the list of channels the user is subscribed to
    return res.status(200).json(
        new ApiResponse(
            200,
            { subscribedChannels: subscribedTo },
            "Successfully fetched all the channels the user is subscribed to"
        )
    );
});


export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}