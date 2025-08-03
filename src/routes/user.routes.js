import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
    //🔴Imp point-> you can define import name like this, but only when you have exported the file in { } export
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    //this is how we inject a middleware
    upload.fields([         //fields accepts an array   //Returns middleware that processes multiple files associated with the given form fields.
        {
            name: "avatar",
            maxCount: 1
        },{
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)
//http://localhost:8000/users/register

router.route("/login").post(loginUser)
//http://localhost:8000/users/login

//secured routes -> user must be logged in to reach these routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)

export default router