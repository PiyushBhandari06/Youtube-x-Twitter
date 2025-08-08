import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import { Video } from "../models/video.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


//create playlist
const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    if (!name || !description) {
        throw new apiError(400, "name and description both are required");
    }

    const playlist = await Playlist.create({            //creates a new Playlist document in the database with the given data.
        name,
        description,
        owner: req.user?._id,
    });
    if (!playlist) {
        throw new apiError(500, "failed to create playlist");
    }

    return res.status(200).json(new apiResponse(200, playlist, "playlist created successfully"));
})



//update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body

    if (!name || !description) {
        throw new apiError(400, "name and description both are required");
    }

    if (!isValidObjectId(playlistId)) {                         //Uses mongoose.Types.ObjectId.isValid() behind the scenes.
        throw new apiError(400, "Invalid PlaylistId");
    }
    
    const playlist = await Playlist.findById(playlistId);       //Searches for the playlist in the database using the ID, If not found, playlist will be null.
    if (!playlist) {
        throw new apiError(404, "Playlist not found");
    }
    
    if (playlist.owner.toString() !== req.user?._id.toString()) {       //Compares the playlist owner's ID with the currently logged-in user’s ID (req.user._id).
        throw new apiError(400, "only owner can edit the playlist");
    }
    
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $set: {
                name,
                description,
            },
        },
        { new: true }       //Returns the updated document(necessary)
    );
    
    return res
    .status(200)
    .json(
        new apiResponse(200,updatedPlaylist,"playlist updated successfully")
    );
})



//delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    
    if (!isValidObjectId(playlistId)) {                             //Uses mongoose.Types.ObjectId.isValid() behind the scenes.
        throw new apiError(400, "Invalid PlaylistId");
    }
    
    const playlist = await Playlist.findById(playlistId);           //Searches for the playlist in the database using the ID, If not found, playlist will be null.
    if (!playlist) {
        throw new apiError(404, "Playlist not found");
    }
    
    if (playlist.owner.toString() !== req.user?._id.toString()) {           //Compares the playlist owner's ID with the currently logged-in user’s ID (req.user._id).
        throw new apiError(400, "only owner can delete the playlist");
    }
    
    await Playlist.findByIdAndDelete(playlist?._id);        
    
    return res
    .status(200)
    .json(
            new apiResponse(200,{},"playlist deleted successfully")
        );
})



//add video to playlist
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid PlaylistId or videoId");
    }

    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);
    //Fetches both documents from the database
    // If not found, the variables will be null
    
    if (!playlist) {
        throw new apiError(404, "Playlist not found");
    }
    if (!video) {
        throw new apiError(404, "video not found");
    }
    
    
    if (                                                                        // || OR means: “if either one is false, reject.”
        playlist.owner.toString() !== req.user?._id.toString() ||       
        video.owner.toString() !== req.user?._id.toString()
    ){
        throw new apiError(400, "only owner can add video to their playlist");
    }
    
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $addToSet: {            //$addToSet avoids duplicates (only adds if not already present)
                videos: videoId,
            },
        },
        { new: true }               // returns the updated document
    );
    
    if (!updatedPlaylist) {
        throw new apiError(
            400,
            "failed to add video to playlist please try again"
        );
    }
    
    return res
    .status(200)
    .json(
        new apiResponse(200, updatedPlaylist, "Added video to playlist successfully")
    );
})



//remove video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params            //Extracts playlistId and videoId from the URL.

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid PlaylistId or videoId");
    }
    
    //Retrieves the playlist and video from the DB.
    const playlist = await Playlist.findById(playlistId);       
    const video = await Video.findById(videoId);
    
    if (!playlist) {
        throw new apiError(404, "Playlist not found");
    }
    if (!video) {
        throw new apiError(404, "video not found");
    }

    
    if (
        playlist.owner.toString() !== req.user?._id.toString() ||
        video.owner.toString() !== req.user?._id.toString()
    ){
        throw new apiError(403, "Only owner can remove video from their playlist");
    }

    
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId,        //$pull to remove videoId from videos array.
            },
        },
        { new: true }                   //returns the updated document.
    );

    return res
    .status(200)
    .json(
            new apiResponse(200, updatedPlaylist, "Removed video from playlist successfully")
        );

})



//get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    if (!isValidObjectId(playlistId)) {
        throw new apiError(400, "Invalid PlaylistId");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new apiError(404, "Playlist not found");
    }

    const playlistVideos = await Playlist.aggregate([               //Starts an aggregation pipeline on the Playlist collection.
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)        //Filters for the playlist with the given ID.
            }
        },
        {
            $lookup: {                         //Joins the videos collection to get the video Ids
                from: "videos",
                localField: "videos",           //videos field from playlist model(collection)
                foreignField: "_id",            //_id (mongoDBid) of video model(collection)
                as: "videos",
            }
        },
        {
            $match: {
                "videos.isPublished": true      //Only keep playlists with published videos
                //Keeps only playlists where at least one video is published.
                // If all videos are unpublished, playlist is filtered out.
            }
        },
        {
            $lookup: {                          //Joins the users collection to get the playlist's owner details.
                from: "users",
                localField: "owner",            //user field from playlist model
                foreignField: "_id",            //_id (mongoDBid) of User model
                as: "owner",
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"            //number of published videos in the playlist
                },
                totalViews: {
                    $sum: "$videos.views"       //sum of views across all published videos
                },
                owner: {
                    $first: "$owner"            //flattens the owner array to a single object
                }
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1,
                totalVideos: 1,
                totalViews: 1,
                videos: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1
                },
                owner: {
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1
                }
            }
        }
        
    ]);

    return res
        .status(200)
        .json(new apiResponse(200, playlistVideos[0], "playlist fetched successfully"));
})



//get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    
    if (!isValidObjectId(userId)) {
        throw new apiError(400, "Invalid userId");
    }

    const playlists = await Playlist.aggregate([                //Aggregate query to get user’s playlists
        {
            $match: {                                           //Finds all playlists where the owner matches the userId.
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {                                          //Join with videos collection
                from: "videos",
                localField: "videos",                           //videos field from playlist model(collection)
                foreignField: "_id",                            //_id (mongoDBid) of video model(collection)
                as: "videos"
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"                //Counts the number of video entries in the playlist.
                },
                totalViews: {
                    $sum: "$videos.views"           //Adds up all views from each video in the playlist.
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                totalVideos: 1,
                totalViews: 1,
                updatedAt: 1
            }
        }
    ]);

    return res
    .status(200)
    .json(new apiResponse(200, playlists, "User playlists fetched successfully"));
})



export {
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getPlaylistById,
    getUserPlaylists,
}