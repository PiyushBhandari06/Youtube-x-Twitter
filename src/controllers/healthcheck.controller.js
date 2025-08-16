import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const healthcheck = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new apiResponse(200, { message: "Everything is O.K" }, "Ok"));
})

export {healthcheck}