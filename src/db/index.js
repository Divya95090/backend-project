import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

/*
✅ connectDB Function:
- Used to connect to your MongoDB database using Mongoose.
- It uses async/await and proper error handling.
*/

const connectDB = async () => {
try {
    // 🧠 mongoose.connect() returns a Mongoose Connection instance (a promise)
    // connectionInstance is an object that contains metadata about the connection

    const connectionInstance = await mongoose.connect(
    `${process.env.MONGODB_URI}/${DB_NAME}`
    );

    /*
    🔍 What's inside connectionInstance?
    It contains properties like:
    - connectionInstance.connection.host        → The host (server address) you're connected to
    - connectionInstance.connection.name        → The database name
    - connectionInstance.connection.port        → The port used to connect
    - connectionInstance.connection.readyState  → The status of the connection (1 = connected)

    Example:
    {
    connection: {
        host: '127.0.0.1',
        port: 27017,
        name: 'myDatabase',
        readyState: 1,
        ...
    },
    ...
    }
    */

    // ✅ Successful connection message
    console.log(`\n✅ MongoDB connected !! DB HOST : ${connectionInstance.connection.host}`);
} catch (error) {
    // ❌ If connection fails, log the error
    console.log("❌ MONGODB connection FAILED: ", error);

    /*
    🔥 process.exit(1)
    - Immediately stops the Node.js process with an error code.
    - (0) → Success
    - (1) → Uncaught fatal error
    - (2) → Misuse of shell built-ins
    - Other codes like 130, 137, etc. are also used in various contexts.
    */

    process.exit(1); // Stops the app (because DB is critical — no point continuing)
}
};

export default connectDB;
