import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import { subscription } from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//Get the channel stats like total video views, total subscribers, total videos, total likes etc.
const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    const totalSubscribers = await subscription.aggregate([             //Runs an aggregation query on the subscription collection, to count total subscribers for this channel.
        {
            $match: {               
                channel: new mongoose.Types.ObjectId(userId)
                //filters documents where channel equals the current user’s ObjectId (channel owner).
            }
        },
        {
            $group: {                       //groups all matched documents together
                _id: null,                  //(_id: null) don't assign any id
                subscribersCount: {         //sums up the count ($sum: 1) to get total subscribers.
                    $sum: 1 
                }
            }
        }
    ]);
    //totalSubscribers will be an array with one object like { _id: null, subscribersCount: <number> }.


    const video = await Video.aggregate([                               //Runs an aggregation on the Video collection to calculate total likes, views, and videos for the channel owner.
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)              //filters videos where owner is the current user.
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
                //joins the likes collection, where video._id matches likes.video. This pulls all likes for each video into an array likes.
            }
        },
        {
            $project: {             //why need this ? Before grouping, you want to shape each video document to include the specific fields you'll sum:
                totalLikes: {
                    $size: "$likes"         //takes the likes field just created(as: "likes",)from the joined document above
                },
                totalViews: "$views",       //takes the views field from the video document.
                totalVideos: 1              //sets to 1 for counting videos later.
            }
        },
        {
            $group: {                       //groups all videos into one group
                _id: null,
                totalLikes: {
                    $sum: "$totalLikes"
                },
                totalViews: {
                    $sum: "$totalViews"
                },
                totalVideos: {
                    $sum: 1                 //total count of videos. //For each document in this group, add 1 to the sum.
                }
            }
        }
    ]);

    const channelStats = {      //Constructs a stats object to return.
        totalSubscribers: totalSubscribers[0]?.subscribersCount || 0,
        totalLikes: video[0]?.totalLikes || 0,
        totalViews: video[0]?.totalViews || 0,
        totalVideos: video[0]?.totalVideos || 0
    };

    return res
        .status(200)
        .json(
            new apiResponse(200,channelStats,"channel stats fetched successfully")
        );
})



//Get all the videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {     
    const userId = req.user?._id;

    const videos = await Video.aggregate([                          //Starts an aggregation pipeline on the Video collection, to fetch and transform video data.
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
                //Filters videos where the owner field matches the current user’s ObjectId.
            }
        },
        {
            $lookup: {                          //Performs a left outer join with the likes collection.
                from: "likes",
                localField: "_id",              //_id(object id) of each document in Video model/Collection
                foreignField: "video",          //video field in likes Model
                as: "likes"                     //Adds an array field likes to each video document containing all related like documents.
            }
        },
        {
            $addFields: {
                createdAt: {                //Breaks down the original createdAt date into parts (year, month, day, etc.) using $dateToParts.
                    $dateToParts: { date: "$createdAt" }
                },
                likesCount: {               //Counts the number of likes for the video by taking the size of the likes array.
                    $size: "$likes"
                }
            }
        },
        {
            $sort: {                //Sorts the videos in descending order by createdAt.
                createdAt: -1
            }
        },
        {
            $project: {
                _id: 1,
                "videoFile.url": 1,
                "thumbnail.url": 1,
                title: 1,
                description: 1,
                createdAt: {
                    year: 1,
                    month: 1,
                    day: 1
                },
                isPublished: 1,
                likesCount: 1
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new apiResponse(200, videos, "channel stats fetched successfully")
    );
})



export {
    getChannelStats, 
    getChannelVideos
}