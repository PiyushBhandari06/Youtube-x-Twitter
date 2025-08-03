import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";         //These tokens are commonly used for authentication and authorization in web applications.
//jwt is a bearer token, Whoever bears (holds) the token is granted access.
import bcrypt from "bcrypt"         //libraries used for encryption of data

const userSchema = new Schema(
    {
        username:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,        //just optimizes searching
        },
        email:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullname:{
            type: String,
            required: true,
            trim: true,
            index: true,        //just optimizes searching
        },
        avatar:{
            type: String,   //cloudinary url
            required: true,
        },
        coverImage:{
            type: String,   //cloudinary url
        },
        watchHistory:[
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password:{
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken:{
            type: String
        }
    },{timestamps: true}
)

// direct encryption isn't possible, that's why we use hooks given by mongoose:
    
//encryption of password:-
    // pre hook -> sets a middleware function that acts just before some events already declared in mongoose like->"save" (or validate,remove,updateOne,deleteOne):-
//userSchema.pre("save",() => {})                  //avoid using arrow fn as callback fn, as arrow fn doesn't have 'this' keyword, it doesn't know context reference.
userSchema.pre("save",async function(next){         //middleware must have the access to its flag(next)
    //encryption process is time consuming, that's why we need async await
    if(this.isModified("password")) {               //only execute when password field is modified,not any other field ! else it will keep encrypting password even when any other field is updated
    this.password = await bcrypt.hash(this.password,10)   //it hashes(encryptes) this.password & The 10 is the "salt rounds" — also called the cost factor.
    next()      //pass the middleware flag ahead !                                      // Meaning of Salt Rounds: It's the number of times the hashing algorithm runs internally. Higher number = more secure, but slower.
    }
})

//Checking of passsword:-
    //custom method 
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)            //it returns true or false
    //compares encryted password and password entered by user
}



//jwt Tokens
// 🧱 Structure of a JWT
//       A JWT looks like this:
//       xxxxx.yyyyy.zzzzz

// It has 3 parts, separated by dots:
// Part	    Name	    Purpose
// xxxxx	Header	    Info about the token & algorithm
// yyyyy	Payload	    The data (user ID, roles, etc.)
// zzzzz	Signature	Verifies the token wasn’t changed

userSchema.methods.generateAccessToken = function(){        //this process doesn't take that much time, ki we need to use async await, but still if you want you can, just store in a variable first then await on it !
    return jwt.sign(
        {
            //write Payload :-
            //payload key: payload value
            _id: this._id,          //id is recieved from mongoDB
            //only id can be enough, rest you can access during database queries
            //but still if you want you can access as many fields as you want in payload itself..
            email: this.email,
            username: this.username,
            fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,          
            //refresh token keeps refreshing, thats why we use store less info. in this payload
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )        
}
// we will learn more about these later


export const User = mongoose.model("User", userSchema)