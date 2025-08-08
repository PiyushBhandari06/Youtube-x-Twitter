import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//create tweet
const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content) {
        throw new apiError(400, "content is required");
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user?._id,
    });
    if (!tweet) {
        throw new apiError(500, "failed to create tweet please try again");
    }

    return res
        .status(200)
        .json(new apiResponse(200, tweet, "Tweet created successfully")
        );
})



//update tweet
const updateTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { tweetId } = req.params;

    if (!content) {
        throw new apiError(400, "content is required");
    }

    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Invalid tweetId");
    }

    const tweet = await Tweet.findById(tweetId);                         //Fetches the tweet document from MongoDB using the given tweetId.
    if (!tweet) {
        throw new apiError(404, "Tweet not found");
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {         //Compares the tweet's owner ID with the logged-in user (req.user._id).
        throw new apiError(400, "only owner can edit thier tweet");
    }

    const newTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content,                //Updates the tweet's content using MongoDB's $set operator.
            },
        },
        { new: true }                   //updated tweet is returned
    );

    if (!newTweet) {
        throw new apiError(500, "Failed to edit tweet, please try again");
    }

    return res
        .status(200)
        .json(new apiResponse(200, newTweet, "Tweet updated successfully"));
})



//delete tweet
const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new apiError(400, "Invalid tweetId");
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new apiError(404, "Tweet not found");
    }

    if (tweet?.owner.toString() !== req.user?._id.toString()) {
        throw new apiError(400, "only owner can delete thier tweet");
    }

    await Tweet.findByIdAndDelete(tweetId);

    return res
        .status(200)
        .json(new apiResponse(200, {tweetId}, "Tweet deleted successfully"));
})



//get user tweets
const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new apiError(400, "Invalid userId");
    }

    const tweets = await Tweet.aggregate([                      
        {
            $match: {                                               //Filters tweets where the owner matches the given userId.
                owner: new mongoose.Types.ObjectId(userId),
            },
        },
        {
            $lookup: {                                              //Looks up the user info for each tweet owner.
                from: "users",
                localField: "owner",                                //owner field(document) from tweet model(collection)
                foreignField: "_id",                                //_id (mongoDBid) of the owner model(collection)
                as: "ownerDetails",
                pipeline: [                 //this is sub-pipeline
                    {                       //“From the matched user document, return only username and avatar fields. Exclude everything else.”
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {                                              //Looks up the tweet field in like model
                from: "likes",
                localField: "_id",                                  //id field in tweet(current)
                foreignField: "tweet",                              //tweet field in like model
                as: "likeDetails",
                pipeline: [
                    {
                        $project: {           //“From the matched user document, return only Likedby field. Exclude everything else.”
                            likedBy: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                likesCount: {                       // Total likes for each tweet
                    $size: "$likeDetails",
                },
                ownerDetails: {                     //Unwraps the array from $lookup
                    //Taking the first (and only) element out of the array so you’re left with just the object, not the array.
                    $first: "$ownerDetails",
                },
                isLiked: {                          //Checks if the logged-in user liked the tweet
                    $cond: {
                        //⚪
                        if: {$in: [req.user?._id,{ $ifNull: ["$subscribers.subscriber", [] ] }]},
                        then: true,
                        else: false
                    }
                }
            },
        },
        {
            $sort: {            //sorty by Most recent tweets first.
                createdAt: -1   //descending
            }
        },
        {
            $project: {
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1,
                isLiked: 1
            },
        },
    ]);

    return res
        .status(200)
        .json(new apiResponse(200, tweets, "Tweets fetched successfully"));
})



export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
}