import mongoose, {isValidObjectId} from "mongoose"
//isValidObjectId is a utility function provided by Mongoose to check whether a given value is a valid MongoDB ObjectId.
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


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
    console.log(video);
    return res.status(200).json(new apiResponse(200, video, "Videos fetched successfully"));
})



//get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body;

    //if either field is missing or blank, it throws an error.
    if ([title, description].some((field) => field?.trim() === "")) {       //.some(...): Checks if any of the fields meet a condition.  
        throw new apiError(400, "All fields are required");
    }

    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

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

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}