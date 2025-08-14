import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary, deleteOnCloudinary} from "../utils/cloudinary.js"
import {apiResponse} from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from 'mongoose';

const generateAccessAndRefreshTokens = async (userId)=>{
    try {

        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return{accessToken, refreshToken}

    } catch (error) {
        throw new apiError(500, "Tokens regarding issue occurred !")
    }
}

const registerUser = asyncHandler( async (req,res) => {

    const {fullname, email, username, password} = req.body

    if([fullname, email, username, password].some((field)=> field?.trim() === "")){
        throw new apiError(400, "All fields (fullname, email, username, password) are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]   
    })

    if (existedUser) {
        throw new apiError(409, "User with email or username already exists" )

    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;              

    let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
        }

    if (!avatarLocalPath) {
        throw new apiError(400, "avatar is required")
    }

    const avatar =await uploadOnCloudinary(avatarLocalPath)
    const coverImage =await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new apiError(400, "avatar is required")
    }

    const newUser = await User.create({
        fullname,
        avatar: {
            public_id: avatar.public_id,
            url: avatar.secure_url
        },  
       coverImage: coverImage
        ? {
            public_id: coverImage.public_id,
            url: coverImage.secure_url
        }
        : undefined,
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(newUser._id).select(

        "-password -refreshToken" 
    )

    if (!createdUser) {
        throw new apiError(500, "something went wrong while registering the User")
    }

    return res.status(201).json(                     
        new apiResponse(201, createdUser, "user registered successfully !")          
    )
} )

const loginUser = asyncHandler(async (req,res)=> {

    const {email, username, password} = req.body

    if (!username && !email) {
        throw new apiError(400, "username or email is required")
    }

    const user = await User.findOne({               
        $or: [{username}, {email}]
    })
    if(!user){
        throw new apiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)      
    if(!isPasswordValid){
        throw new apiError(401, "Password invalid !")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {       
        httpOnly: true,     
        secure: true,

    }

    return res
    .status(200)
    .cookie("accessToken", accessToken,options )
    .cookie("refreshToken", refreshToken,options )
    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken

            },
            "User logged In Successfully"
        )
    )
}) 

const logoutUser = asyncHandler(async (req,res)=>{

    await User.findByIdAndUpdate(
        req.user._id,   
        {               

            $unset: {                         
                refreshToken: 1               

            }

        },
        {   
            new: true
        }
    )

    const options = {       
        httpOnly: true,     
        secure: true,
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "user logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req,res)=>{

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken 
    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }
    try {

            const decodedToken = jwt.verify(
                incomingRefreshToken, 
                process.env.REFRESH_TOKEN_SECRET
            )

            const user = await User.findById(decodedToken?._id)
            if (!user) {
                throw new apiError(401, "invalid refresh Token")
            }

            if (incomingRefreshToken !== user?.refreshToken){
                throw new apiError(401, "Refresh token is expired or used")

            }

            const {accessToken, refreshToken:newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

            const options = {
                httpOnly:true,
                secure: true
            }

            return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new apiResponse(
                    200,
                    {
                        accessToken, 
                        refreshToken: newRefreshToken 
                    },
                    "Access Token refreshed successfully"
                )
            )
    } catch (error) {
        throw new apiError(401, error?.message || "Error in validating refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res)=>{

    const {oldPassword, newPassword} = req.body     

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new apiError(401, "Old Password is incorrect")
    }

    user.password = newPassword     

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed successfully"))
}) 

const getCurrentUser = asyncHandler(async (req, res) => {

    return res
    .status(200)
    .json(new apiResponse(200, req.user, "Current User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res)=> {

    const{fullname, email} = req.body
    if(!fullname || !email){
        throw new apiError(400, "Please provide all required fields")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {fullname, email}  
        }, 
        { new: true }
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {

    const avatarLocalPath = req.file?.path              
    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)        
    if (!avatar?.url) {
        throw new apiError(400, "Avatar upload failed")
    }

    const user = await User.findById(req.user?._id).select("avatar");       

    const avatarToDelete = user?.avatar?.public_id;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{ 
                avatar:{                            
                    public_id: avatar.public_id,
                    url: avatar.secure_url,         
                }
            }  
        },
        { new: true }
    ).select("-password")

    if (avatarToDelete && updatedUser.avatar.public_id) {       
        await deleteOnCloudinary(avatarToDelete);
    }

    return res
    .status(200)    
    .json(new apiResponse(200, updatedUser, "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {

    const coverImageLocalPath = req.file?.path              

    if (!coverImageLocalPath) {
        throw new apiError(400, "Cover Image is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)        
    if (!coverImage.url) {
        throw new apiError(400, "Cover Image upload failed")
    }

     const user = await User.findById(req.user?._id).select("coverImage");

    const coverImageToDelete = user?.coverImage?.public_id;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: {                               
                    public_id: coverImage.public_id,
                    url: coverImage.secure_url
                }
            }      
        },
        { new: true }
    ).select("-password")

    if (coverImageToDelete && updatedUser.coverImage.public_id) {
        await deleteOnCloudinary(coverImageToDelete);
    }

    return res
    .status(200)    
    .json(new apiResponse(200, updatedUser, "Cover Image updated successfully"))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new apiError(400, "Username is required")
    }

    const channel = await User.aggregate([
        {   
            $match: {username: username?.toLowerCase()}  
        },
        {
            $lookup: {

                from: "subscriptions",          

                localField: "_id",              
                foreignField: "channel",        

                as: "subscribers"               
            }

},
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {   

            $addFields:{
                subscribersCount: {$size: "$subscribers"},      
                subscribedToCount: {$size: "$subscribedTo"},
                isSubscribed: {                                 
                    $cond: {

                        if: { $in: [ req.user?._id, "$subscribers.subscriber" ] },      
                        then: true,
                        else: false
                    }
                }
            } 

        },
        {   
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                "avatar.url": 1,
                coverImage: 1,
                email:1
            }
        }
    ])
    if (!channel?.length) {
        throw new apiError(404, "Channel does not exist")
    }
    return res
    .status(200)
    .json(new apiResponse(200, channel[0], "Channel profile fetched successfully"))

})

const getUserWatchHistory = asyncHandler(async (req, res) => {

    const user = await User.aggregate([
        {
            $match: {_id: new mongoose.Types.ObjectId(req.user._id)}
        },
        {
            $lookup:{   

                from: "videos",                           
                localField: "watchHistory",               
                foreignField: "_id",                      
                as: "watchHistory",                        

                pipeline: [
                    {   
                        $lookup: {   

                            from: "users",                     
                            localField: "owner",               
                            foreignField: "_id",                
                            as: "owner",                        
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        "avatar.url": 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {

                            owner: { $first: "$owner" }                

                        }
                    }
                ]
            }

        }
    ])

    return res
    .status(200)
    .json(new apiResponse(200, user[0].watchHistory, "User watch history fetched successfully"))

})

export {
    registerUser,
    loginUser, 
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory
}