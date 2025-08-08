import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { subscription } from "../models/subscription.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


//toggle subscription
const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new apiError(400, "Invalid channelId");
    }

    const isAlreadySubscribed = await subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId,
    });

    if (isAlreadySubscribed) {
        await subscription.findByIdAndDelete(isAlreadySubscribed?._id);     //_id -> subscription doc's mongoDB ID

        return res
            .status(200)
            .json(
                new apiResponse(200,{ subscribed: false },"unsubscribed successfully")
            );
    }

    await subscription.create({
        subscriber: req.user?._id,
        channel: channelId,
    });

    return res
        .status(200)
        .json(
            new apiResponse(200,{ subscribed: true },"subscribed successfully")
        );
})



// controller to return channels list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params     //the user whose subscribed Channels list you want to fetch.

    const subscribedChannels = await subscription.aggregate([               //Starts an aggregation pipeline on the subscription collection(model).
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),
                //Filters documents in subscription collection(model) where the subscriber field equals the provided subscriberId.
                //Also converts subscriberId string into a MongoDB ObjectId for matching.
            },
        },
        {
            $lookup: {                          //Performs a join operation from subscription collection to users collection:
                from: "users",
                localField: "channel",          //channel field in subscription(current) model.
                foreignField: "_id",            //_id(mongoDb id) field in User model.
                as: "subscribedChannel",        //Stores matching user(s) in an array field called subscribedChannel in subscription(current) model.
                pipeline: [     //sub-pipeline
                    {
                        $lookup: {                      //join the videos collection to fetch all videos owned by that user.  
                            from: "videos",
                            localField: "_id",          //_id(mongoDB id) field in User model.
                            foreignField: "owner",      //the "owner" field in the "videos" collection which stores the user ID who owns the video.
                            as: "videos",
                        },
                    },
                    {
                        $addFields: {               
                            latestVideo: {
                                $last: "$videos",   //picks the last video from the user's videos array (assuming videos are sorted by creation date).
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscribedChannel",
            //$unwind deconstructs the subscribedChannel array to output one document per channel instead of an array.
        },
        {
            $project: {
                _id: 0,
                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullname: 1,
                    avatar: 1,
                    latestVideo: 1
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new apiResponse(200, subscribedChannels, "subscribed channels fetched successfully")
        );
})



// controller to return subscribers list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    let { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new apiError(400, "Invalid channelId");
    }

     channelId = new mongoose.Types.ObjectId(channelId);            //Converts the channelId string into a MongoDB ObjectId instance for querying

    const subscribers = await subscription.aggregate([              //Starts an aggregation pipeline on the subscription collection
        {
            $match: {
                channel: channelId 
            },
        },
        {
            $lookup: {                                  //Performs a join with the users collection, to get subscriber user details:
                from: "users",
                localField: "subscriber",               //points to the subscriber field in the subscription(current) Model.
                foreignField: "_id",                    //points to the _id(mongoDB ID) field in User Model.
                as: "subscriber",                       //Results will be stored in a new field subscriber (an array).
                pipeline: [
                    {                                                   //This sub-pipeline allows further processing on the joined users documents above.
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",                          //points to the _id(mongoDB ID) field in User Model.
                            foreignField: "channel",                    //points to the channel field in subscription Model.
                            as: "subscribedToSubscriber",               //Stores this array in the field subscribedToSubscriber
                        },
                    },
                    {
                        $addFields: {
                            subscribedToSubscriber: {
                                $cond: {
                                    if: { $in: [channelId, "$subscribedToSubscriber.subscriber"],      
                                        //Check if the channelId exists inside the array of subscriber IDs ($subscribedToSubscriber.subscriber).
                                        //basically -> "Is the original channel (channelId from params) subscribing to this subscriber user?"
                                    },
                                    then: true,
                                    else: false,
                                },
                            },
                            subscribersCount: {
                                $size: "$subscribedToSubscriber",           //returns the length of the array $subscribedToSubscriber.
                                //This is the count of how many subscribers the current subscriber user has.
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriber",     //Converts the subscriber array from the $lookup into a single object for each subscription document.
        },
        {
            $project: {
                _id: 0,                 //means exclude the root-level _id field of the aggregation result document
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullname: 1,
                    avatar: 1,
                    subscribedToSubscriber: 1,
                    subscribersCount: 1,
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new apiResponse(200, subscribers, "subscribers fetched successfully")
        );
})



export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}