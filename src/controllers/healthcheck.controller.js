import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//build a healthcheck response that simply returns the OK status as json with a message
const healthcheck = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new apiResponse(200, { message: "Everything is O.K" }, "Ok"));
})

export {healthcheck}
    