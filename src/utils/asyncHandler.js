// .Then & .catch METHOD :-

const asyncHandler = (requesthandler) => {
    return (req, res, next) => {                // middleware function that Express can use :
        // req → The incoming HTTP request.
        // res → The HTTP response object.
        // next → A function used to pass control to the next middleware or error handler. 
        Promise.resolve(requesthandler(req, res, next))     
        // Even if requesthandler is not explicitly async (but still returns a Promise), 
        // wrapping it with Promise.resolve() ensures we always get a Promise object.
        .catch((err)=>next(err))
        // next(err) passes the error to Express's built-in error-handling middleware. learn more abt it
    }
}
export { asyncHandler }



// TRY & CATCH METHOD :-

    // A Higher-Order Function (HOF) is:
    // ✅ A function that takes another function as an argument, returns a function, or does both.

// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {} }
// const asyncHandler = (func) =>  () => {} 
// const asyncHandler = (func) => async () => {} 

    //func is requesthandler here, just name is changed
// const asyncHandler = (func) => async (err, req, res, next) => {      //next is used for middlewares
//     try {
//         await func(err, req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }