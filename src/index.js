// As early as possible in your application, import and configure dotenv:
// we want -> as soon as our app loads, our env variables should be available everywhere, we often load our env variables in the first file thats being loaded(index.js here)

// require('dotenv').config({path:'./env'})             //-> CommonJS syntax
    //this method creates inconsistency in our project code, since everything else is in ES6 syntax
import dotenv from "dotenv";                            //-> ES6 syntax 
    //this method creates consistency, 
    // but it requires an addition of experimental feature in package.json file
    // explanation -> https://youtu.be/w4z8Py-UoNk?si=OcD_NEJZH7r9uw3I , from 32:33 to
import connectDB from "./db/index.js";

dotenv.config({
    path:'./env'
})

// METHOD : 1
connectDB() // since async functin returns a promise
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at PORT: ${process.env.PORT}`);
    })
})
.catch((error)=>{
    console.log("MONGO-DB connection failed !!! ", error);
})



/*  
//METHOD : 2

    //approach 2a:-                         // create a function and call it

// function connectDB(){}       
// connectDB()


    //approach 2b:-     // ()() - IIFE    // create a function(arrow fn here) and it will be immediately invoked using IIFE
  
import express from "express";
const app = express();
;(async ()=>{           //use semicolon(;) infront of IIFE so that incase if your editor didn't apply semi-colon on the line before iife, a prblm can be occur.
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

        app.on("error", (error)=> {
            console.log("ERROR: ",error);
            throw error
        })
        app.listen(process.env.PORT, ()=>{
            console.log(`App is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR: ", error)
        throw error                                 //process exits when we use-> throw error
    }
})()    

*/