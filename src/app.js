import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

//app.use syntax will always be used for configuration & middlewares 
// app.use(cors())         //majorly only this much is needed 
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
    // This tells the browser and the server that it's okay to include credentials like:
    //      Cookies
    //      Authorization headers (e.g., Bearer tokens)
    //      TLS client certificates
    // in cross-origin HTTP requests.
}))

//this handles data coming thru form submission in frontend :
app.use(express.json({limit: "16kb"}))          
    // When a frontend (HTML/React/Angular, etc.) form submits data to the backend — typically using:
    // fetch(), axios.post(), or <form method="POST">
    // ...the form data is sent as part of the HTTP request body.

//this handles data coming thru url :
app.use(express.urlencoded({extended: true, limit: "16kb"}))

//this handles data coming in file/folder format(pdf,images)
app.use(express.static("public"))   //public is just the name for the public asset we have created in this project

//this is used to access user's browser cookies and set them thru our server. so that we can perform CRUD opertaions on it
app.use(cookieParser())
//there are ways to keep secured cookies in user's browser that can only be read & remove by our server


//🔘routes importing:-
import userRouter from "./routes/user.routes.js"        
    //🔴Imp point-> you can define import name acc to your wish(userRouter here), but only when you have exported the file in default export
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"


//🔘routes declaration:-
// app.get()       //we can't use this here
                   //we are only able to use this syntax when we are defining the routes and controller in it, but now we have defined route in a separate file.

// app.use("/users", userRouter)          //now to get router, we will need to use middleware syntax[that is use()] 
    //working -> //http://localhost:8000/users -> this gives controll to userRouter method defined in user.routes.js file
    

    //An industry standard practice is: 
    //whenever you are defining your api, define its url such that it consists : 'you are defining api using - api' & 'the version of your api - v1/v2..'
app.use("/api/v1/users", userRouter)
    //working -> //http://localhost:8000/api/v1/users
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)

// export default app;
export { app }