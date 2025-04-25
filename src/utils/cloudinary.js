import { v2 as cloudinary } from 'cloudinary';
import { log } from 'console';
import fs from 'fs';

/*
📌 ABOUT FILE HANDLING & CLOUDINARY INTEGRATION

- In a Node.js server, uploaded files are often temporarily stored in a local path before they are processed.
- Once the file is uploaded to Cloudinary, we remove it from the local storage to free up space and avoid clutter.
- Files can either be *linked* or *unlinked*:
  👉 If it's a symbolic link (shortcut), only the link is removed, not the original file.
  👉 If it's an actual file, it is permanently deleted when `fs.unlinkSync()` is used.
*/


/*
🔐 CONFIGURE CLOUDINARY

We use `cloudinary.config()` to authorize and initialize the Cloudinary client using our environment variables.

These environment variables should be defined in your `.env` file:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
*/

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


/*
📤 uploadOnCloudinary(localFilePath)

This function:
1. Takes a local file path as input.
2. Uploads the file to Cloudinary using `cloudinary.uploader.upload`.
3. If successful, logs the response and returns it.
4. If failed, deletes the local file (cleanup) using `fs.unlinkSync`.

Why `resource_type: 'auto'`?
- Cloudinary can handle many file types (image, video, pdf, etc.).
- Setting `auto` lets Cloudinary automatically detect the type (smart & easy).
*/

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'auto'
    });

    // File successfully uploaded
    console.log("✅ File uploaded to Cloudinary:", response.url);
    return response;

  } catch (error) {
    // ❌ Upload failed, clean up the local file to avoid unnecessary storage
    fs.unlinkSync(localFilePath);
    console.error("❌ Cloudinary upload failed, local file deleted.");
  }
};


/*
📦 Example use case (commented):

cloudinary.v2.uploader
  .upload("dog.mp4", {
    resource_type: "video", 
    public_id: "my_dog",          // optional: custom public ID
    overwrite: true,              // overwrite if it already exists
    notification_url: "https://mysite.example.com/notify_endpoint" // webhook callback
  })
  .then(result => console.log(result));
*/


// 🛠 Export the function so it can be used in route/controller logic
export { uploadOnCloudinary };
