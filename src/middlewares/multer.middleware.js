import multer from "multer";

/*
📦 MULTER CONFIGURATION

Multer is a middleware used for handling `multipart/form-data`, which is primarily used for uploading files.

Here, we are configuring:
1. Where to store the uploaded file (`destination`)
2. What name to give the uploaded file (`filename`)

We are using disk storage (not memory storage), which saves the file to a local folder on your server.
*/

const storage = multer.diskStorage({

  // 🔹 destination: defines where the file should be saved locally
  destination: function (req, file, cb) {
    // `file` is the file object provided by Multer
    // `cb` is the callback: cb(error, destinationPath)
    cb(null, "./public/temp"); // We are storing it in a temporary folder (outside src folder)
    // Always resolves from project root
  },

  // 🔹 filename: defines the filename to use when saving the file
  filename: function (req, file, cb) {
    // `file.originalname` preserves the original name of the file
    cb(null, file.originalname);
  }
});

/*
🔐 Note:
- This is just temporary storage.
- After successful upload to services like Cloudinary, we’ll delete this file to avoid local clutter.
- The uploaded file will be accessible inside `req.file` or `req.files` depending on how it's used in the route.

For example, with:
  upload.single("avatar")
➡ `req.file` contains the uploaded avatar file

With:
  upload.array("images")
➡ `req.files` contains an array of uploaded files
*/

export const upload = multer({
  // In ES6, when the property name matches the value name, we can shorthand like this:
  storage // same as: storage: storage
});


/*✅ You can use:
js
Copy
Edit
destination: "./public/temp"
BUT, whether it works depends on where you run your server from.*/

/*
Multer's destination path is relative to the directory from where the Node.js process is being executed, not necessarily relative to the file in which this code exists.

So:

If you're running your app using something like node src/index.js or using nodemon, then:

"./public/temp" will resolve relative to the current working directory — typically the root of your project.

But if you run it from somewhere else (like a subdirectory), it may not resolve as expected.

*/