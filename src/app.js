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


// export default app;
export { app }