import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { subscription } from "../models/subscription.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

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
        await subscription.findByIdAndDelete(isAlreadySubscribed?._id);     

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

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params     

    const subscribedChannels = await subscription.aggregate([               
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),

            },
        },
        {
            $lookup: {                          
                from: "users",
                localField: "channel",          
                foreignField: "_id",            
                as: "subscribedChannel",        
                pipeline: [     
                    {
                        $lookup: {                      
                            from: "videos",
                            localField: "_id",          
                            foreignField: "owner",      
                            as: "videos",
                        },
                    },
                    {
                        $addFields: {               
                            latestVideo: {
                                $last: "$videos",   
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscribedChannel",

        },
        {
            $project: {
                _id: 0,
                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1,
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

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    let { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new apiError(400, "Invalid channelId");
    }

     channelId = new mongoose.Types.ObjectId(channelId);            

    const subscribers = await subscription.aggregate([              
        {
            $match: {
                channel: channelId 
            },
        },
        {
            $lookup: {                                  
                from: "users",
                localField: "subscriber",               
                foreignField: "_id",                    
                as: "subscriber",                       
                pipeline: [
                    {                                                   
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",                          
                            foreignField: "channel",                    
                            as: "subscribedToSubscriber",               
                        },
                    },
                    {
                        $addFields: {
                            subscribedToSubscriber: {
                                $cond: {
                                    if: { $in: [channelId, "$subscribedToSubscriber.subscriber"],      

                                    },
                                    then: true,
                                    else: false,
                                },
                            },
                            subscribersCount: {
                                $size: "$subscribedToSubscriber",           

                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$subscriber",     
        },
        {
            $project: {
                _id: 0,                 
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1,
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