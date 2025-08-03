import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandler(async (req,_,next)=>{         //res was not being used,so we added _ instead, this happens alot in prodcution grade apps
    try {
        //retrieve accessToken from cookies or header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        //if there is no token :
        if (!token) {
            throw new apiError(401, "unauthorized request")
        }
    
        //if there is token : we will need to verify the token using jwt
        const decodedtoken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        // database query: to check in database
        const user = await User.findById(decodedtoken?._id).select("-password -refreshToken")
    
        //if no user with that accessToken :
        if (!user) {
            // Discussion needed here regarding frontend
            throw new apiError(401, "access Token not valid")
        }
        //if a user with that accessToken :
        req.user = user;                        //add an object in req, named user having all values of user we just defined above
        next()

    } catch (error) {
        throw new apiError(401, error?.message || "Invalid access Token")
    }
})