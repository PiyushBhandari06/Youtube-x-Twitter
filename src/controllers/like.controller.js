import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"



//toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const likedAlready = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id,
    });

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);

        return res
            .status(200)
            .json(new apiResponse(200, { videoId, isLiked: false }, "Video Like removed"));
    }

    await Like.create({
        video: videoId,
        likedBy: req.user?._id,
    });

    return res
        .status(200)
        .json(new apiResponse(200, { videoId, isLiked: true }, "Video Like added"));
})



//toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params

    if (!isValidObjectId(commentId)) {
        throw new apiError(400, "Invalid commentId");
    }

    const likedAlready = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id,
    });

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);

        return res
            .status(200)
            .json(new apiResponse(200, { commentId, isLiked: false }, "Comment Like removed"));
    }

    await Like.create({
        comment: commentId,
        likedBy: req.user?._id,
    });

    return res
        .status(200)
        .json(new apiResponse(200, {commentId, isLiked: true }, "Comment Like added"));
})



//toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Invalid tweetId");
    }


    const likedAlready = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id,
    });

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);

        return res
            .status(200)
            .json(new apiResponse(200, { tweetId, isLiked: false }, "Tweet Like removed"));
    }

    await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id,
    });

    return res
        .status(200)
        .json(new apiResponse(200, { tweetId, isLiked: true }, "Tweet Like added"));
})



//get all liked videos
const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideosAggegate = await Like.aggregate([
        {
            $match: {                                                       //Find all documents in the likes collection where the logged-in user has liked something
                likedBy: new mongoose.Types.ObjectId(req.user?._id),        //likedBy is converted to ObjectId for matching.
            },
        },
        {
            $lookup: {                              //Join the videos collection
                from: "videos",
                localField: "video",                //video field in Like(current) Model
                foreignField: "_id",                //_id(mongoDBid) of Video model
                as: "likedVideo",                   //The result is saved in a new field likedVideo (as an array).
                pipeline: [                 //sub-pipeline
                    {
                        $lookup: {                  //Join the User collection,to find the user (owner) of the video from the users collection.
                            from: "users",
                            localField: "owner",    //owner field in Like(current) Model
                            foreignField: "_id",    //_id(mongoDBid) of User model
                            as: "ownerDetails",     
                        },
                    },
                    {
                        $unwind: "$ownerDetails",       //$unwind turns the array into a single object
                    },
                ],
            },
        },
        {
            $unwind: "$likedVideo",     //Unwinds the likedVideo array into individual documents so each like shows one video cleanly.
        },
        {
            $sort: {
                createdAt: -1,          
            },
        },
        {
            $project: {
                _id: 0,
                likedVideo: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullname: 1,
                        "avatar.url": 1,
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new apiResponse(200,likedVideosAggegate,"liked videos fetched successfully")
        );
})



export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}