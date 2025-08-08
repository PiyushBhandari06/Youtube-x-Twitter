import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {apiError} from "../utils/apiError.js"
import { Video } from "../models/video.model.js";
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//add a comment to a video
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!content) {
        throw new apiError(400, "Content is required");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new apiError(404, "Video not found");
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    });

    if (!comment) {
        throw new apiError(500, "Failed to add comment please try again");
    }

    return res
        .status(201)
        .json(new apiResponse(201, comment, "Comment added successfully"));
})



//update a comment
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
        throw new apiError(400, "content is required");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new apiError(404, "Comment not found");
    }

    if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new apiError(400, "only comment owner can edit their comment");
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set: {
                content
            }
        },
        { new: true }
    );

    if (!updatedComment) {
        throw new apiError(500, "Failed to edit comment please try again");
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, updatedComment, "Comment edited successfully")
        );
})



//delete a comment
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new apiError(404, "Comment not found");
    }

    if (comment?.owner.toString() !== req.user?._id.toString()) {
        throw new apiError(400, "only comment owner can delete their comment");
    }

    await Comment.findByIdAndDelete(commentId);

    //⚪
    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user
    });

    return res
        .status(200)
        .json(
            new apiResponse(200, { commentId }, "Comment deleted successfully")
        );
})



//get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const video = await Video.findById(videoId);
    if (!video) {
        throw new apiError(404, "Video not found");
    }

    const commentsAggregate = Comment.aggregate([                   //Start a MongoDB aggregation pipeline on the Comment collection
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)         //Only fetch comments that belong to the given videoId.
            }
        },
        {
            $lookup: {                                              //Join the users collection, to get user details for each comment's owner
                from: "users",
                localField: "owner",                                //owner field in comment(current) Model(collection)
                foreignField: "_id",                                //_id(mongoDBid) of User Model
                as: "owner"                                         //The result is added as an array owner.
            }
        },
        {
            $lookup: {                                               //Join the likes collection, to find all likes related to the comment.
                from: "likes",
                localField: "_id",                                   //_id field in comment(current) model
                foreignField: "comment",                             //comment field in like model
                as: "likes"                                          //The result is added as an array likes.
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"                                  //Number of likes on the comment (just counts the array).
                },
                owner: {
                    $first: "$owner"                                  //Takes the first (and only) user from the owner array, to flatten it.
                },
                isLiked: {                                           //Tries to check if the current user is in the list of users who liked the comment.
                    $cond: {    
                        //⚪
                        if: { $in: [req.user?._id,{ $ifNull: ["$likes.likedBy", [] ] }]}, 
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $sort: {                //Sort comments so that the most recent ones appear first.
                createdAt: -1       //descending
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1
                },
                isLiked: 1
            }
        }
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(commentsAggregate,options);

    return res
        .status(200)
        .json(new apiResponse(200, comments, "Comments fetched successfully"));
})



export {
    addComment, 
    updateComment,
    deleteComment,
    getVideoComments, 
}