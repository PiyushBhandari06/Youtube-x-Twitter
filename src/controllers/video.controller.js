import mongoose, {isValidObjectId} from "mongoose"
//isValidObjectId is a utility function provided by Mongoose to check whether a given value is a valid MongoDB ObjectId.
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary,deleteOnCloudinary} from "../utils/cloudinary.js"


//get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    // console.log(userId);

    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'

    if (query) {
        pipeline.push({     // This stage performs a full-text search on the video documents
            $search: {
                index: "search-videos",
                text: {
                    query: query,                            //query is the search term provided by user
                    path: ["title", "description"]           //search only on title, description fields
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {                       // This ensures: The userId sent in query is a valid ObjectId format.
            throw new apiError(400, "Invalid userId for matching videos");
        }
        // this is conditional match stage!
        // If no userId is provided, then the if (userId) condition won't run, so this whole block is skipped.
        // If userId is provided, filter videos by owner:-
        pipeline.push({    // This stage filters the videos based on the owner (userId)
            $match: {
                owner: new mongoose.Types.ObjectId(userId)    // Match videos by owner (userId)
            }
        });
    }
    // this is uncoditional match stage !
    // if no userId is provided, it will match all the videos that are published by all owners ( bcoz, we have isPublished field as true in video Model/Schema )
    // if userId is provided, then it will match only the videos of that userId :-
    pipeline.push({         //This stage fetches videos only that are set isPublished as true
        $match: {
            isPublished: true
        } 
    });           



    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    const allowedSortBy = ["views", "createdAt", "duration"];
    const allowedSortType = ["asc", "desc"];

    // Validate & set default values
    if (!allowedSortBy.includes(sortBy)) {
    sortBy = "createdAt";  // default sort field
    }
    if (!allowedSortType.includes(sortType)) {
    sortType = "desc";     // default sort order
    }

    pipeline.push({         // This stage sorts the videos based on the specified field and order
        $sort: {
            [sortBy]: sortType === "asc" ? 1 : -1  // if Ascending or else Descending
        }
    });

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [     //sub-pipeline -> “From each matched user, only return the username and avatar.url fields.”
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
            $unwind: {      // This stage unwinds the ownerDetails array, so each video document will have a single ownerDetails object instead of an array
                path: "$ownerDetails",          
                preserveNullAndEmptyArrays: true
            }    
            //Chatgpt about this `unwind` stage:
        }
    )

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);
    // console.log(video);
    return res.status(200).json(new apiResponse(200, video, "Videos fetched successfully"));
})

//get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body;

    //if either field is missing or blank, it throws an error.
    if ([title, description].some((field) => field?.trim() === "")) {       //.some(...): Checks if any of the fields meet a condition.  
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

    const video = await Video.create({              //creates a new video document in the database with the given data.
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

//get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params  //req.params is used to access URL parameters in a route.
    
    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }
    //to get userId from request body and convert string to ObjectId
    // classic way : 
        // let userId = req.body;
        // userId = new mongoose.Types.ObjectId(userId)
    //or
    // modern way : 
        // using req.user?._id is a more secure way to get userId from request, using the authentication middleware !
    if (!isValidObjectId(req.user?._id)) {
        throw new apiError(400, "Invalid userId");
    }

    const video = await Video.aggregate([{
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)   
                // videoId is the _id of the document in your MongoDB 'videos' collection
                // _id is the default field id in MongoDB documents that uniquely identifies each document.
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
                pipeline: [{            //sub-pipeline -> to get all subscriptions where that user is the "channel" being subscribed to.
                    $lookup: {
                        from: "subscriptions",
                        localField: "_id",                  // user's _id (the channel)
                        foreignField: "channel",            // in subscriptions, channel is the one being followed
                        as: "subscribers"
                    }
                },
                {
                    $addFields: {
                        // ⚪
                        subscribersCount: {
                            $size: { $ifNull: ["$subscribers", []] }
                        },
                        isSubscribed: {
                            $cond: {
                                // ⚪
                                if: {$in: [req.user?._id,{ $ifNull: ["$subscribers.subscriber", [] ] }]},   //$in: [ value, array ], checks if value is in the array.
                                then: true,
                                else: false
                            }
                        }
                    }
                },
                {
                    $project: {
                        //It controls which fields are included or excluded in the documents passed along the aggregation pipeline,Fields not listed here will be excluded (unless you explicitly include them).
                        username: 1,                    //Setting a field to 1 means include this field.
                        // "avatar.url": 1,             //MongoDB expects avatar to be an object that has a url key. But your avatar is just a string, so it has no url property, and this projection returns nothing.
                        avatar: 1,
                        subscribersCount: 1,
                        isSubscribed: 1
                    }
                }]
            }
        },
        {
            $addFields: {
                // ⚪
                likesCount: {
                    $size: { $ifNull: ["$likes", []] }
                },
                owner: {                //owner: converts the owner array to a single object.
                    $first: "$owner"
                },
                isLiked: {              // isLiked: checks if the current logged in user has liked this video.
                    $cond: {
                        // ⚪
                        if: {$in: [req.user?._id,{ $ifNull: ["$likes.likedBy", [] ] }]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,     //MongoDB expects videoFile to be an object and it is has url key. which is true in our case
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

    // increment views if video fetched successfully
    await Video.findByIdAndUpdate(videoId, {        //To track how many times the video has been viewed. Each time someone fetches this video’s details, the view count increases.
        $inc: {
            views: 1
        }
    });

    // add this video to user watch history
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {    //$addToSet — adds an item to an array only if it doesn’t already exist.
            watchHistory: videoId                   //To keep track of which videos the user has watched, without duplicates
        }
    });

    return res.status(200).json(new apiResponse(200, video[0], "video details fetched successfully"));
})

//update video details only -> like title, description, thumbnail
const updateVideoDetails = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    if (!(title && description)) {
        throw new apiError(400, "title and description are required");
    }

    const video = await Video.findById(videoId);    //fetches the video from database
    if (!video) {
        throw new apiError(404, "No video found");
    }
    if (video?.owner.toString() !== req.user?._id.toString()) {             //Checks if the logged-in user is the owner of the video.
        throw new apiError(400,"You can't edit this video as you are not the owner");
    }

    //deleting old thumbnail 
    const thumbnailToDelete = video.thumbnail.public_id;  //Stores the public_id of the current thumbnail for deletion later.

    //and updating with new one
    const thumbnailLocalPath = req.file?.path;            //Gets the local path of the new uploaded thumbnail from req.file.

    if (!thumbnailLocalPath) {
        throw new apiError(400, "thumbnail is required");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail) {
        throw new apiError(400, "thumbnail not found");
    }

    const updatedVideo = await Video.findByIdAndUpdate(             //Updates the video in the database:
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {                                    // New thumbnail object (with public_id and url), same as defined in video schema
                    public_id: thumbnail.public_id,
                    url: thumbnail.url
                }
            }
        },
        { new: true }               // means return the updated document (neccessary)
    );

    if (!updatedVideo) {
        throw new apiError(500, "Failed to update video, Please try again");
    }

    if (updatedVideo) {
        await deleteOnCloudinary(thumbnailToDelete);
    }

    return res.status(200).json(new apiResponse(200, updatedVideo, "Video updated successfully"));
    
})

//delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);                     //fetches the video from database
    if (!video) {
        throw new apiError(404, "No video found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {     //Checks if the logged-in user is the owner of the video.
        throw new apiError(400,"You can't delete this video as you are not the owner");
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);
    if (!videoDeleted) {
        throw new apiError(400, "Failed to delete the video please try again");
    }

    //deleted the thumbnail image from Cloudinary using its public_id.
    await deleteOnCloudinary(video.thumbnail.public_id);                // video model has thumbnail public_id stored in it->check videoModel

    await deleteOnCloudinary(video.videoFile.public_id, "video");       // specify video while deleting video   //Second argument "video" may indicate Cloudinary should treat this as a video resource.

    //⚪
    // Deletes all Like documents related to this video.
    // await Like.deleteMany({
    //     video: videoId
    // })

    //⚪
    // Deletes all Comment documents related to this video.
    // await Comment.deleteMany({
    //     video: videoId,
    // })
    
    return res.status(200).json(new apiResponse(200, {}, "Video deleted successfully"));
    // {} -> there is simply no data to send back after a successful deletion.
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new apiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);                    //fetches the video from database
    if (!video) {
        throw new apiError(404, "Video not found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {     //Checks if the logged-in user is the owner of the video.
        throw new apiError(400,"You can't toggle publish status as you are not the owner");
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {                                     //Use $set to flip isPublished from true → false or false → true.
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
    deleteVideo,
    togglePublishStatus
}