import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type: Schema.Types.ObjectId,           //the one who is subscribing
        ref: "User"
    },
    channel:{
        type: Schema.Types.ObjectId,           //the one to whom 'subscriber' is subscribing
        ref: "User"
    }
},{timestamps: true})

subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true }); 
//means the combination of subscriber and channel must be unique, { unique: true } tells MongoDB to enforce this at the database level.

export const subscription = mongoose.model("subscription", subscriptionSchema)