import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary,deleteOnCloudinary} from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    
    const pipeline = [];

    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"],
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new apiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    pipeline.push({ $match: { isPublished: true } });

    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(new apiResponse(200, video, "Videos fetched successfully"));
});


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {       
        throw new apiError(400, "All fields are required");
    }

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new apiError(400, "videoFileLocalPath is required");
    }
    if (!thumbnailLocalPath) {
        throw new apiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new apiError(400, "Video file not found");
    }

    if (!thumbnail) {
        throw new apiError(400, "Thumbnail not found");
    }

    const video = await Video.create({              
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished: false
    });

    const videoUploaded = await Video.findById(video._id);

    if (!videoUploaded) {
        throw new apiError(500, "videoUpload failed due to server error !!!");
    }

    return res.status(200).json(new apiResponse(200, video, "Video uploaded successfully"));

})


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params  

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new apiError(400, "Invalid userId");
    }

    const video = await Video.aggregate([{
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)   

            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "videoLikes",
                as: "videoLikes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [{            
                    $lookup: {
                        from: "subscriptions",
                        localField: "_id",                  
                        foreignField: "channel",            
                        as: "subscribers"
                    }
                },
                {
                    $addFields: {

                        subscribersCount: {
                            $size: { $ifNull: ["$subscribers", []] }
                        },
                        isSubscribed: {
                            $cond: {

                                if: {$in: [req.user?._id,{ $ifNull: ["$subscribers.subscriber", [] ] }]},   
                                then: true,
                                else: false
                            }
                        }
                    }
                },
                {
                    $project: {

                        username: 1,                    
                        "avatar.url": 1,
                        subscribersCount: 1,
                        isSubscribed: 1
                    }
                }]
            }
        },
        {
            $addFields: {

                likesCount: {
                    $size: { $ifNull: ["$likes", []] }
                },
                owner: {                
                    $first: "$owner"
                },
                isLiked: {              
                    $cond: {

                        if: {$in: [req.user?._id,{ $ifNull: ["$likes.likedBy", [] ] }]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,     
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);

    if (!video) {
        throw new apiError(500, "failed to fetch video");
    }

    await Video.findByIdAndUpdate(videoId, {        
        $inc: {
            views: 1
        }
    });

    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {    
            watchHistory: videoId                   
        }
    });

    return res.status(200).json(new apiResponse(200, video[0], "video details fetched successfully"));
})


const updateVideoDetails = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    if (!(title && description)) {
        throw new apiError(400, "title and description are required");
    }

    const video = await Video.findById(videoId);    
    if (!video) {
        throw new apiError(404, "No video found");
    }
    if (video?.owner.toString() !== req.user?._id.toString()) {             
        throw new apiError(400,"You can't edit this video as you are not the owner");
    }

    const thumbnailToDelete = video.thumbnail.public_id;  

    const thumbnailLocalPath = req.file?.path;            

    if (!thumbnailLocalPath) {
        throw new apiError(400, "thumbnail is required");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail) {
        throw new apiError(400, "thumbnail not found");
    }

    const updatedVideo = await Video.findByIdAndUpdate(             
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {                                    
                    public_id: thumbnail.public_id,
                    url: thumbnail.url
                }
            }
        },
        { new: true }               
    );

    if (!updatedVideo) {
        throw new apiError(500, "Failed to update video, Please try again");
    }

    if (updatedVideo) {
        await deleteOnCloudinary(thumbnailToDelete);
    }

    return res.status(200).json(new apiResponse(200, updatedVideo, "Video updated successfully"));

})


const deleteAVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);                     
    if (!video) {
        throw new apiError(404, "No video found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {     
        throw new apiError(400,"You can't delete this video as you are not the owner");
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);
    if (!videoDeleted) {
        throw new apiError(400, "Failed to delete the video please try again");
    }

    await deleteOnCloudinary(video.thumbnail.public_id);                

    await deleteOnCloudinary(video.videoFile.public_id, "video");       

    await Like.deleteMany({
        video: videoId
    })

    await Comment.deleteMany({
        video: videoId,
    })

    return res.status(200).json(new apiResponse(200, {}, "Video deleted successfully"));

})


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);                    
    if (!video) {
        throw new apiError(404, "Video not found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {     
        throw new apiError(400,"You can't toggle publish status as you are not the owner");
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {                                     
                isPublished: !video?.isPublished
            }
        },
        { new: true }
    );
    if (!toggledVideoPublish) {
        throw new apiError(500, "Failed to toggle video publish status");
    }

    return res
        .status(200)
        .json(
            new apiResponse(200,{ isPublished: toggledVideoPublish.isPublished },"Video publish toggled successfully")
        );
})


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideoDetails,
    deleteAVideo,
    togglePublishStatus
}