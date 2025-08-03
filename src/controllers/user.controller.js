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

export {registerUser,loginUser, logoutUser,refreshAccessToken}