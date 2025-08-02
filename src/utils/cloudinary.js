import {v2 as cloudinary} from "cloudinary"
import fs from "fs"         
// filesystem- this library is inbuilt in nodejs, no need to install

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath)=>{
    try {
        if(!localFilePath) return null;

        //upload the file on cloudinary
        const response = await cloudinary.v2.uploader.upload(localFilePath, {resource_type: "auto"})
        //file has been uploaded successfully
        console.log("file has been uploaded on cloudinary", response.url);
        return response;    //returns url
    } catch (error) {
        //remove the locally saved temporary file as the upload operation got failed
        fs.unlinkSync(localFilePath)   //unlink file syncrhonously
        return null;
    }
}


export {uploadOnCloudinary}