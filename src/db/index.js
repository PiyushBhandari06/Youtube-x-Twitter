import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
// TWO rules before connecting database :
// 1. problem can occur while connecting/calling to database, therefore always wrap in try-catch.
// 2. always assume database is in another continent(connecting to database takes time), therefore always use async await.


const connectDB = async ()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        //we can store this in a variable, as mongoDb returns an object
        
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        //this check is done so that we can know exactly where we are connected,since production server,software server,etc. all are there in one database.
        //so we may not get connected to a different server

    } catch (error) {
        console.log("MONGO-DB connection failed: ", error);
        process.exit(1)     
        // instead of throw error, you can use process.exit() method created in node.
        // read about it, it has many other codes as 0,1...& so on.
    }
}

export default connectDB;