import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    //TODO: create playlist
    if(!(name&&description)){
        throw new ApiError(400,"Name and description not provided")
    }
    const playlist = await Playlist.create({
                            name,
                            description,
                            owner: req.user._id
                            })
    if (!playlist) {
        throw new ApiError(400,"Error while creating playlist")
    }

    return res.status(200).json(
        new ApiResponse(200,playlist,"Playlist have been created successfully")
    )
})


const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // ✅ Step 1: Validate input
    if (!userId) {
        throw new ApiError(400, "UserId is missing");
    }
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "UserId is invalid");
    }

    // ✅ Step 2: Aggregate all playlists created by the given user
    const userPlaylists = await Playlist.aggregate([
        {
            // 🔍 Match only the playlists created by the specified user
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            // 🔗 Perform a lookup to fetch full video documents for each playlist
            $lookup: {
                from: "videos",                 // name of the collection to join from
                localField: "videos",           // array of video ObjectIds in playlist
                foreignField: "_id",            // match each video ID to full video doc
                as: "playlistVideos",           // output array field containing full video docs

                // 📦 Nested pipeline to further enrich each video with likes & owner data
                pipeline: [
                    {
                        // 🔗 Lookup likes for each video
                        $lookup: {
                            from: "likes",              // collection containing likes
                            localField: "_id",          // current video ID
                            foreignField: "video",      // match likes related to this video
                            as: "likes"                 // output array of like docs
                        }
                    },
                    {
                        // 🔗 Lookup owner (user) for each video
                        $lookup: {
                            from: "users",              // user collection
                            localField: "owner",        // video owner's user ID
                            foreignField: "_id",        // match to user's _id
                            as: "owner",                // result will be an array of one user
                            pipeline: [
                                {
                                    // 📄 Project only needed fields
                                    $project: {
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // 🧠 Add computed fields to video documents
                        $addFields: {
                            likesCount: { $size: "$likes" }, // count number of likes per video
                            owner: { $first: "$owner" }       // flatten owner array into single object
                        }
                    }
                ]
            }
        },
        {
            // 🔗 Lookup playlist owner's info for top-level playlist doc
            $lookup: {
                from: "users",                  // again, user collection
                localField: "owner",            // playlist owner's user ID
                foreignField: "_id",            // match to user's _id
                as: "owner",                    // output array
                pipeline: [
                    {
                        // 📄 Project only required fields
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            // 🧠 Flatten the playlist owner's info to a single object
            $addFields: {
                owner: { $first: "$owner" }     // convert [userObj] → userObj
            }
        },
        {
            // 📦 Final shape of the playlist document returned in the API
            $project: {
                name: 1,
                description: 1,
                playlistVideos: 1,              // enriched video list with likesCount & owner
                owner: 1                        // enriched owner with username & avatar
            }
        }
    ]);

    // ✅ Step 3: Handle case where no playlists exist
    if (!userPlaylists.length) {
        return res.status(200).json(
            new ApiResponse(200, [], "No playlists yet...")
        );
    }

    // ✅ Step 4: Return fetched playlists
    return res.status(200).json(
        new ApiResponse(200, userPlaylists, "User playlists fetched successfully")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    // ✅ Step 1: Validate input
    if (!playlistId) {
        throw new ApiError(400, "PlaylistId is missing");
    }
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "PlaylistId is invalid");
    }

    // ✅ Step 2: Aggregate playlist by its ID and enrich it with related data
    const playlist = await Playlist.aggregate([
        {
            // 🔍 Match the specific playlist document by its _id
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            // 🔗 Lookup full video documents for each video in the playlist
            $lookup: {
                from: "videos",                 // the 'videos' collection
                localField: "videos",           // field in Playlist: array of video IDs
                foreignField: "_id",            // match video _id
                as: "playlistVideos",           // output array field to hold matched video documents

                // 📦 Nested pipeline to further enrich each video
                pipeline: [
                    {
                        // 🔗 Lookup likes for each video
                        $lookup: {
                            from: "likes",              // 'likes' collection
                            localField: "_id",          // video ID
                            foreignField: "video",      // match where Like.video = video._id
                            as: "likes"                 // array of like docs
                        }
                    },
                    {
                        // 🔗 Lookup owner details for each video
                        $lookup: {
                            from: "users",              // 'users' collection
                            localField: "owner",        // video.owner
                            foreignField: "_id",        // match to user's _id
                            as: "owner",                // result will be an array
                            pipeline: [
                                {
                                    // 📄 Only include needed fields from user
                                    $project: {
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // 🧠 Add computed fields to each video
                        $addFields: {
                            likesCount: { $size: "$likes" }, // number of likes
                            owner: { $first: "$owner" }       // flatten owner array
                        }
                    }
                ]
            }
        },
        {
            // 🔗 Lookup playlist owner's user profile
            $lookup: {
                from: "users",                   // 'users' collection
                localField: "owner",             // playlist.owner
                foreignField: "_id",             // match user's _id
                as: "owner",                     // result is an array
                pipeline: [
                    {
                        // 📄 Include only required fields
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            // 🧠 Flatten playlist owner's user info from array to object
            $addFields: {
                owner: { $first: "$owner" }      // convert [userObj] → userObj
            }
        },
        {
            // 📦 Final shape of the returned playlist object
            $project: {
                name: 1,
                description: 1,
                playlistVideos: 1,               // enriched videos with likes & owner
                owner: 1                         // enriched playlist owner
            }
        }
    ]);

    // ✅ Step 3: Handle case when playlist is not found
    if (!playlist.length) {
        throw new ApiError(400, "Playlist not found!");
    }

    // ✅ Step 4: Return the final result
    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist Fetched Successfully!")
    );
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    // ✅ Step 1: Input validation
    if (!(playlistId && videoId)) {
        // If either ID is missing, respond with 400 Bad Request
        throw new ApiError(400, "PlaylistId or VideoId is missing");
    }

    // ✅ Step 2: Validate ObjectId format for both inputs
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoID");
    }

    // ✅ Step 3: Add video to playlist (if not already present)
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            // $addToSet adds value to array only if it doesn't already exist (prevents duplicates)
            $addToSet: {
                videos: videoId
            }
        },
        {
            new: true // return the updated playlist after modification
        }
    );

    // ✅ Step 4: Handle playlist not found
    // ⚠️ Bug fix: `.length` is undefined for objects; use `!playlist` instead
    if (!playlist) {
        throw new ApiError(400, "Playlist not found");
    }

    // ✅ Step 5: Send response
    return res.status(200).json(
        new ApiResponse(200, playlist, "Video added to playlist successfully!")
    );
});


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    // ✅ Check presence of both IDs
    if (!(playlistId && videoId)) {
        throw new ApiError(400, "PlaylistId or videoId is missing");
    }

    // ✅ Validate both IDs together
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlistId or videoId");
    }

    // ✅ Update only if playlist belongs to the user (ownership check inside the query)
    const updatedPlaylist = await Playlist.findOneAndUpdate(
        {
            _id: playlistId,
            owner: req.user._id, // Ownership check here
        },
        {
            $pull: {
                videos: videoId, // Remove the video
            },
        },
        {
            new: true,
        }
    );

    if (!updatedPlaylist) {
        throw new ApiError(403, "Playlist not found or you're not authorized to update it");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Video has been removed from playlist successfully!")
    );
});


const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    // ✅ Step 1: Validate input
    if (!playlistId) {
        throw new ApiError(400, "PlaylistId is missing");
    }

    // ✅ Step 2: Check if playlistId is a valid MongoDB ObjectId
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }

    // ✅ Step 3: Find and delete the playlist only if the user is the owner
    const playlist = await Playlist.findOneAndDelete(
        {
            _id: new mongoose.Types.ObjectId(playlistId), // filter by playlist ID
            owner: req.user._id                            // ensure ownership
        },
        { new: true } // (not necessary for delete ops, only used with findOneAndUpdate)
    );

    // ✅ Step 4: Handle playlist not found or not owned by user
    if (!playlist) {
        throw new ApiError(400, "Playlist not found or you're not authorized to delete it");
    }

    // ✅ Step 5: Return success response
    return res.status(200).json(
        new ApiResponse(200, playlist, "Playlist Deleted Successfully!")
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    // ✅ Step 1: Validate the playlist ID
    if (!playlistId) {
        throw new ApiError(400, "PlaylistId is missing");
    }
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }

    // ✅ Step 2: Validate request body fields
    if (!name || !description) {
        throw new ApiError(400, "Name and description are required");
    }

    // ✅ Step 3: Update the playlist only if the owner matches the logged-in user
    const updatedPlaylist = await Playlist.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(playlistId), // match playlist by ID
            owner: new mongoose.Types.ObjectId(req.user._id) // ensure ownership
        },
        {
            $set: {
                name,
                description
            }
        },
        {
            new: true // return the updated document
        }
    );

    // ✅ Step 4: If not found or not updated (e.g., unauthorized)
    if (!updatedPlaylist) {
        throw new ApiError(400, "Playlist not found or you're not authorized to update it");
    }

    // ✅ Step 5: Return success response
    return res.status(200).json(
        new ApiResponse(200, updatedPlaylist, "Playlist has been updated successfully")
    );
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}