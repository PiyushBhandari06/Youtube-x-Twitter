import { asyncHandler } from "../utils/asyncHandler.js";
//asynchandler is the wrapper we are using here ! it is a High Order Function

const registerUser = asyncHandler( async (req,res) => {
    res.status(200).json({      //The response is already being sent using res.status().json(). In Express, once you send a response (with res.send(), res.json(), etc.), that ends the request lifecycle.
        message: "ok"
    })
} )

export {registerUser}