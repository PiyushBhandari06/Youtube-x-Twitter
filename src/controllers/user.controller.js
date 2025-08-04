import { asyncHandler } from "../utils/asyncHandler.js";
//asynchandler is the wrapper we are using here to handle web requests! it is a High Order Function
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {apiResponse} from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId)=>{
    try {
        // finds user based on Id
        const user = await User.findById(userId)

        // generates access & refresh tokens
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // save refreshToken in database too:
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return{accessToken, refreshToken}

    } catch (error) {
        throw new apiError(500, "Tokens regarding issue occurred !")
    }
}

const registerUser = asyncHandler( async (req,res) => {
    // res.status(200).json({      //The response is already being sent using res.status().json(). In Express, once you send a response (with res.send(), res.json(), etc.), that ends the request lifecycle.
    //     message: "ok"
    // })

    // algorithm:-
    // 1. get user details from frontend
    // 2. validation - fields shld not be empty
    // 3. check if user already exists: username, email
    // 4. check for images(avatar,coverImage),but must check for avatar since it is required field
    // 5. upload them(avatar,coverImage) to cloudinary, again must check avatar
    // 6. create user object - create entry in db
    // 7. remove password and refresh token field from response
    // 8. check for user creation
    // 9. return res


    //1. 
    // In Express.js, req.body is used to access the data sent by the client in the body of the HTTP request. This is commonly used when handling: 
    // Form submissions (application/x-www-form-urlencoded) & JSON data (application/json)   
    const {fullname, email, username, password} = req.body
    // console.log("email:", email);  //checkpoint !
    // console.log(req.body);

    

    //2.
    // Method 1:
    // if (fullname === ""){
    //     throw new apiError(400, "fullname is required")
    // }
    // ....& so on if else statements for every field

    // Method 2:
    if([fullname, email, username, password].some((field)=> field?.trim() === "")){
        throw new apiError(400, "All fields (fullname, email, username, password) are required")
    }


    //3.
    const existedUser = await User.findOne({
        $or: [{username}, {email}]   //finds data related to either username or email
    })
    
    if (existedUser) {
        throw new apiError(409, "User with email or username already exists" )
        
    }


    // 4.
    // req.body   //until now we learned that we can get all data thru req.body 
                  // but since you have added a middleware in user.routes.js file, so this middlware also provides you some more access(basically provides more fields in req.)
    //the way expressJS provides us req.body by-default,
    //in the same way Multer provides us req.files by-default.

    // console.log(req.files);
    
    // modern way:-                                                  //maybe we have that more access or maybe we may not,so always use -> ?(optinal), its a good practice !
    const avatarLocalPath = req.files?.avatar[0]?.path;              //we used modern way in this, since we are handling the condition it must satisy ahead, unlike coverImage, that's why in coverImage we had to go with classic conditional way.
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;


    // classic conditional way:-
    let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
        }
    
        //this is the condition that we are handling, that's why we used modern way in avatar ! 
    if (!avatarLocalPath) {
        throw new apiError(400, "avatar is required")
    }
    

    //5.
    const avatar =await uploadOnCloudinary(avatarLocalPath)
    const coverImage =await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new apiError(400, "avatar is required")
    }


    // 6.
    const newUser = await User.create({
        fullname,
        avatar: avatar.url,  //we have uploaded avatar on cloudinary that returns a response(an object) but we don't have to send the whole object in our db, so we just save object that has only url of avatar
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })


    // 7.
    const createdUser = await User.findById(newUser._id).select(
        // select method by-default selects all the fields of the User object created in db, therfore we remove those fields which we don't want
        "-password -refreshToken" //this is the syntac
    )


    // 8.
    if (!createdUser) {
        throw new apiError(500, "something went wrong while registering the User")
    }


    // 9.
    // return res.status(201).json({createdUser})    //we could have done this way too, but
    return res.status(201).json(                     //we have pre-defined the architecture of json response
        new apiResponse(201, createdUser, "user registered successfully !")          //u may ask, why we gave statuscode again ? when we had res.status(201) right! so basically postman handles this one -> res.status(201) in a specific place(you might have seen where postman shows its statuscode)so that's why !
    )
} )

const loginUser = asyncHandler(async (req,res)=> {
    // algorithm:-
    // 1. get data -> req.body
    // 2. check username or email
    // 3. find the user 
    // 4. password check 
    // 5. access & refresh token
    // 6. send cookies

    // 1.
    const {email, username, password} = req.body
    // console.log(email);


    // 2.
    if (!username && !email) {
        throw new apiError(400, "username or email is required")
    }
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
    // }



    // 3.
    const user = await User.findOne({               
        $or: [{username}, {email}]
    })
    if(!user){
        throw new apiError(404, "User does not exist")
    }
     
    // 4.
    const isPasswordValid = await user.isPasswordCorrect(password)      //remember to use 'user' and not 'User'
    if(!isPasswordValid){
        throw new apiError(401, "Password invalid !")
    }

    // 5.       //we will use access & refresh tokens alot, so we shld create their methods.
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    // 6.
    //the 'user' has an empty refresh token, because you have called generateAccessAndRefreshTokens after storing the instance of user model in this user variable
    //either update the object 
    // or 
    // make a new database query:-
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {       //whenever you send cookies, you have to design some options
        httpOnly: true,     
        secure: true,
        //by default-cookies can be modified in the frontend, these options strictly revoke that, & cookies can only be modified in server.
    }

    //send cookie:-
    return res
    .status(200)
    .cookie("accessToken", accessToken,options )
    .cookie("refreshToken", refreshToken,options )
    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
                // you may ask, why needed to send these Tokens in json response when already sent thru cookies ?
                // this is because, what if user want to save these tokens himself !
            },
            "User logged In Successfully"
        )
    )
}) 

const logoutUser = asyncHandler(async (req,res)=>{
    // user.findById(...)           
    //how do we get data in logoutUser ? we can't make the user fill a form and then we will get data just like we did in loginUser method right !
    
    //we will create our own middleware thru which we will handle this problem !
    await User.findByIdAndUpdate(
        req.user._id,   //find query
        {               //update this
            $set: {                         //mongoDb operator -$set, it updates,sets the values given to it
                refreshToken: undefined
            }
        },
        {   //what this does is basically, returns the new/updated value, else original will be sent with old refreshToken value
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
    // access user's refreshToken
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken 
    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }
    try {
        
            //incomingRefreshToken converted into decodedToken
            const decodedToken = jwt.verify(
                incomingRefreshToken, 
                process.env.REFRESH_TOKEN_SECRET
            )
        
            //is this decoded/incomingRefreshToken present in db? :-
            const user = await User.findById(decodedToken?._id)
            if (!user) {
                throw new apiError(401, "invalid refresh Token")
            }
        
            // cross check the decoded/incomingRefreshToken & 
            // the refreshToken already saved in db thru method-> generatAccessAndRefreshToken above
            //if not same:
            if (incomingRefreshToken !== user?.refreshToken){
                throw new apiError(401, "Refresh token is expired or used")
                
            }
            // if same? : return a new refreshToken to user & again save it in db(generatAccessAndRefreshToken method will handle all this)
        
            const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
        
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
    // access user's oldPassword, newPassword using req.body
    const {oldPassword, newPassword} = req.body     
        //you can also add confirmPassword here, but we are not doing that for now, since this can be handled in frontend itself.
        // const {oldPassword, newPassword, confirmPassword} = req.body     
        // if (newPassword !== confirmPassword) {
        //     throw new apiError(400, "newPassword and confirmPassword do not match")
        // }

    // access user model using req.user
    // req.user is set in user.routes.js file, where we have created a middleware to access user data from token
    const user = await User.findById(req.user?._id)

    // check if oldPassword is correct
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    // if oldPassword is not correct:
    if (!isPasswordCorrect) {
        throw new apiError(401, "Old Password is incorrect")
    }

    // oldPassword is correct:
    user.password = newPassword     // this is being hashed in the User model's pre-save hook

    // save the user
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed successfully"))
}) 

// Using no db call:- 
const getCurrentUser = asyncHandler(async (req, res) => {
    // return the user data from req.user
    return res
    .status(200)
    .json(new apiResponse(200, req.user, "Current User fetched successfully"))
})

// Using db call:-
// const getCurrentUser = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.user?._id).select("-password");
//     res.status(200).json(new apiResponse(200, user, "Current User fetched successfully"));
// });

const updateAccountDetails = asyncHandler(async (req, res)=> {
    // access user's fullname, email using req.body
    const{fullname, email} = req.body
    if(!fullname || !email){
        throw new apiError(400, "Please provide all required fields")
    }

    // update user's fullname, email in db
    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {fullname, email}  //we are using $set operator to update the user details
        }, 
        { new: true }
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    // to access user's avatar from req.file
    const avatarLocalPath = req.file?.path              //Imp -> you can directly save this avatarLocalPath in db, but we are not doing that, since we want to upload it on cloudinary first, then save the url in db
    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar is required")
    }

    // upload avatar to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)        //returns an object with url and other details
    if (!avatar.url) {
        throw new apiError(400, "Avatar upload failed")
    }
    
    // 🔴TODO :Delete the old avatar from cloudinary if it exists, only after uploading the new avatar.
    // This can be done by storing the old avatar url in user model and then deleting it.
    

    // update user's avatar in db
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {avatar: avatar.url}  // we are taking the url from the avatar object returned by uploadOnCloudinary
        },
        { new: true }
    ).select("-password")

    return res
    .status(200)    
    .json(new apiResponse(200, user, "Avatar updated successfully"))

})


const updateUserCoverImage = asyncHandler(async (req, res) => {
    // to access user's cover image from req.file
    const coverImageLocalPath = req.file?.path              //Imp -> you can directly save this coverImageLocalPath in db, but we are not doing that, since we want to upload it on cloudinary first, then save the url in db
    if (!coverImageLocalPath) {
        throw new apiError(400, "Cover Image is required")
    }

    // upload cover image to cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)        //returns an object with url and other details
    if (!coverImage.url) {
        throw new apiError(400, "Cover Image upload failed")
    }

    // 🔴TODO :Delete the old coverImage from cloudinary if it exists, only after uploading the new coverImage.
    // This can be done by storing the old coverImage url in user model and then deleting it.


    // update user's cover image in db
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {coverImage: coverImage.url}  // we are taking the url from the coverImage object returned by uploadOnCloudinary
        },
        { new: true }
    ).select("-password")

    return res
    .status(200)    
    .json(new apiResponse(200, user, "Cover Image updated successfully"))

})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new apiError(400, "Username is required")
    }

    //aggregate pipeline to get user channel profile
    const channel = await User.aggregate([
        {   //match the username in db
            $match: {username: username?.toLowerCase()}  
        },
        {
            $lookup: {
                // this is used to join two collections(model), here we are joining User collection(model) with Subscriptions collection(model), It behaves kind of like a JOIN in SQL.
                // it adds a new field 'subscribers' in the each User document(object) in User collection(model)
                // This new field will contain an array of matched documents from the other(subscription) collection(model).

                from: "subscriptions",          //the model name in db where we are looking up 
                // remember to use lowercase & plural form of the model name, as that's how mongoose stores the model name in db
                localField: "_id",              //the field in User model
                foreignField: "channel",        //the field in Subscription model 
                // these two fields are used to match the User collection(model) with Subscription collection(model)
                as: "subscribers"               //the name of the field to be added in each output/user document
            }

            // working of Lookup:
            // A "document" is a single record in a collection(model).
                // Go to the Subscription collection(model)
                // Find all documents where subscriptions.channel === user._id
                // Add them into a new field called subscribers in each User document.
                // Same goes for the second $lookup, which creates subscribedTo.
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
            //this will add those created fields 'subscribersCount, 'subscribedToCount', 'isSubscribed' in each User document in User collection(model.
            $addFields:{
                subscribersCount: {$size: "$subscribers"},      //$size is a mongoDB operator that returns the size of an array(here subscribers), must use dollar->$subscribers, since it's a field in the aggregation pipeline
                subscribedToCount: {$size: "$subscribedTo"},
                isSubscribed: {                                 //will be true if the user is subscribed to the channel, rest frontend will handle this !
                    $cond: {
                        //i want to check whether in the document subscribers, the user is present or not
                        if: { $in: [ req.user?._id, "$subscribers.subscriber" ] },      //$in: [ value, array ], checks if value is in the array.
                        then: true,
                        else: false
                    }
                }
            } 
            // Operator	                    What it does
            // $lookup	        Joins another collection and adds a new array field
            // $addFields	    Adds or modifies fields in each document in the pipeline
        },
        {   //this will only return the fields that we want in the output, rest will be removed
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email
            }
        }
    ])
    if (!channel?.length) {
        throw new apiError(404, "Channel does not exist")
    }
    return res
    .status(200)
    .json(new apiResponse(200, channel[0], "Channel profile fetched successfully"))
    // channel[0] -> will return the first object in the array, since we are matching the username, there will be only one object in the array
})

const getUserWatchHistory = asyncHandler(async (req, res) => {
    // req.user._id
    // this returns mongoDb id in string type -> '688f480ac5ebddca22d462cf'
    // mongoose converts this string type to ObjectId type -> ObjectId("688f480ac5ebddca22d462cf"), so & when we query the database we can use it directly in the query
        // like this : const user = await User.findById(req.user._id)

    // but, if we manually want to convert it to ObjectId type, we can use mongoose.Types.ObjectId(req.user._id)
    const user = await User.aggregate([
        {
            $match: {_id: new mongoose.Types.ObjectId(req.user._id)}
        },
        {
            $lookup:{   //(populate user's watchHistory array with video documents),
                // └─ inside that lookup, $lookup again (populate each video's owner field with user data)

                //this loopkup is looking up in the video model from User model
                // this will add a new field 'watchHistory' in each User document(object), which will contain the watch history of the user
                from: "videos",                           //the model name in db where we are looking up
                localField: "watchHistory",               //the field in User model
                foreignField: "_id",                      //the field in video model
                as: "watchHistory",                        //the name of the field to be added in each output/user document
                //a sub-pipline needed for the owner details, consider the model link in eraser to understand more.
                pipeline: [
                    {   
                        $lookup: {   //(populate each video's owner field with user data)
                            // └─ So to build the final response:
                                // Get user → populate videos → inside each video, populate the owner

                            // So this is a nested lookup:
                                // First from User → Video
                                // Then from Video → User (to get owner info)

                            //this loopkup is looking up in the User model from video model
                            //this lookup will add a new field 'owner' in each video document(object) in watchHistory
                            from: "users",                     //the model name in db where we are looking up
                            localField: "owner",               //the field in video model
                            foreignField: "_id",                //the field in User model
                            as: "owner",                        //the name of the field to be added in each output/video document
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            // way 1:
                            // owner: {$arrayElemAt: ["$owner", 0]}      //this will convert the owner array to an object, since we are only getting one owner for each video that's why 0.
                            // Explicit about which index you're accessing.
                            // ⚠️ Can throw error if index out of bounds

                            // way 2:
                            $first: "$owner"                             //this will also convert the owner array to an object.
                            // Cannot access other indexes (only the first one).
                            // ✅ Returns null if array is empty

                        }
                    }
                ]
            }

        }
    ])

    return res
    .status(200)
    .json(new apiResponse(200, user[0].watchHistory, "User watch history fetched successfully"))
    // user[0].watchHistory -> will return the watchHistory array of the first object

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