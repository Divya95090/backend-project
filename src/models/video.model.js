import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";


// 🔹 Define the schema for a Video document
const videoSchema = new Schema({

  // 🧠 videoFile - URL pointing to the actual video stored on Cloudinary or another CDN
  videoFile: {
    type: String,
    required: true, // Every video must have a video file URL
  },

  // 🧠 thumbnail - A preview image for the video (also hosted on Cloudinary)
  thumbnail: {
    type: String,
    required: true,
  },

  // 🧠 title of the video
  title: {
    type: String,
    required: true,
  },

  // 🧠 description about the video content
  description: {
    type: String,
    required: true,
  },

  // 🧠 duration - human-readable or time-based format (e.g., "5:32" or "330" seconds)
  duration: {
    type: String,
    required: true,
  },

  // 🧠 views - how many times this video has been watched
  views: {
    type: Number,
    default: 0, // Start with zero views
  },

  // 🧠 isPublished - visibility flag (true means public, false means hidden/unpublished)
  isPublished: {
    type: Boolean,
    default: true,
  },

  // 🧠 owner - reference to the User who uploaded this video
  owner: {
    type: Schema.Types.ObjectId, // Points to a document in the 'User' collection
    ref: 'User'
  }

}, { timestamps: true }) // Automatically adds 'createdAt' and 'updatedAt' fields


videoSchema.plugin(mongooseAggregatePaginate)


// 🔹 Create the Video model
export const Video = mongoose.model('Video', videoSchema);


// ✅ Notes:
// - This schema represents a video object that will be stored in MongoDB.
// - All media files are expected to be uploaded to an external service (e.g., Cloudinary).
// - `owner` links each video to a user in your `User` model using ObjectId referencing.
// - `timestamps` helps track when the video was created or updated.

// 🛠️ Tip:
// You'll be using `mongoose-aggregate-paginate-v2` to paginate aggregation queries on this model.
// This is useful when you're building features like:
//    → Trending videos
//    → Paginated feed
//    → Filtered search results



