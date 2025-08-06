import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: {
                url: String,
                public_id: String,
            },
            required: true,
        },
        thumbnail: {
            type: {
                url: String,
                public_id: String,
            },
            required: true,
        },
        title:{
            type: String,       
            required: true
        },
        description:{
            type: String,       
            required: true
        },
        duration:{               //cloudinary url
            type: Number,   
            required: true
        },
        views:{
            type: Number,       
            default: 0
        },
        isPublished:{
            type: Boolean,
            default: true
        },
        owner:{
            type: Schema.Types.ObjectId,
            ref: "User" 
        }
    },{
        timestamps: true
    }
)

videoSchema.plugin(mongooseAggregatePaginate)
// we will learn more about these later

export const Video = mongoose.model("Video", videoSchema)