import { asyncHandler } from "../utils/asyncHandler.js";
//asynchandler is the wrapper we are using here ! it is a High Order Function
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {apiResponse} from "../utils/apiResponse.js";

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

export {registerUser}