// ✅ Load environment variables before anything else
// Using import syntax keeps the codebase consistent (ESM style)
import dotenv from 'dotenv';
dotenv.config({
  path: '../.env'  // Optional: Only needed if .env is not in root
});

// 🧠 Why not use require('dotenv')?
// Mixing `require()` and `import` (CommonJS and ESModules) breaks consistency
// Stick to one module system — preferably ESModules (import/export)


// ✅ Import other core modules
import mongoose from 'mongoose';
import express from 'express';
import { DB_NAME } from './constants.js';           // Constant for DB name
import connectDB from './db/index.js';              // Reusable DB connection function
import { app } from './app.js';

// 🔌 Connect to MongoDB
connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("Error: ",error);
        throw error
    })
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MONGO db connection failed!!!",err);
})

// 🔎 NOTE: Sometimes the file extension (.js) in import paths is mandatory
// Especially in ESModule-based Node.js apps — omitting it may cause "module not found" errors



// 🧪 Approach 1 - Function based DB connect
/*
function connectDb() {
  // your logic
}
connectDb();
*/


// 🌀 Approach 2 - IIFE (Immediately Invoked Function Expression)
// Useful when you want to directly run an async block on app start
/*
const app = express();

(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

    // 🧠 `app.on('error')` acts like an event listener
    // If express fails to start or bind to a port, this will catch it
    app.on('error', (error) => {
      console.log("Error: ", error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log(`✅ App is listening on port ${process.env.PORT}`);
    });

  } catch (error) {
    console.error("❌ MongoDB Connection Error: ", error);
    throw error;
  }
})();
*/



/*
🧠 Why use async/await for DB connection?

- Real-world databases (like MongoDB Atlas) are often hosted in another continent.
- Network latency is involved, so operations are **asynchronous** — they won’t complete instantly.
- That’s why we use `async/await` to **wait** for the DB to connect before proceeding.
- And since things can go wrong (invalid URI, internet issues, DB server down),
  always wrap such logic in `try...catch` blocks to handle errors gracefully.
*/


/*
🚨 Bonus Tip: What happens if DB fails to connect?

- You should `exit` the process using `process.exit(1)` in such cases
  (1 stands for "failure", 0 stands for "success")

- That way your app won’t continue to run in a broken state.

Example:
catch (error) {
   console.error("MONGODB connection error: ", error);
   process.exit(1);
}
*/












// 📦 Dev Dependencies:
// These are packages/tools we only need during development (e.g., for testing, linting, or building).
// They are NOT included when the project is deployed to production.
//
// ✅ Examples: nodemon, eslint, prettier, vite (in some setups)
//
// You install them using:
// npm install <package-name> --save-dev
// or
// yarn add <package-name> --dev
//
// 🔒 This keeps the production build lighter and faster.





//prettierrc file 
// Prettier config file (.prettierrc) 

//     "singleQuote": false,       // ❌ Use double quotes for strings → "Hello"
//     // ✅ If true, it would use single quotes → 'Hello'

// "bracketSpacing": true,     // ✅ Adds spaces inside object literals → { name: "Divya" }
//     // ❌ If false → {name: "Divya"}

// "tabWidth": 2,              // Sets indentation to 2 spaces (most common in JS projects)

// "trailingComma": "es5",     // Adds trailing commas wherever valid in ES5 (objects, arrays, etc.)
//     // Example: [1, 2, 3,] or { name: "Divya", }

// "semi": true                // ✅ Always add semicolons at the end of statements
//     // ❌ If false, Prettier will remove semicolons
// }
// 📌 Why Use Prettier?
// It helps auto-format your code consistently.

// Saves time spent on formatting manually.

// Works well with most editors (especially VS Code) with auto-save or format-on-save enabled.

// 🔧 Pro Tips:
// You can create this config in your project root as either:

// .prettierrc

// .prettierrc.json

// Or add it in package.json under "prettier" key

// You can also create a .prettierignore file (like .gitignore) to skip formatting certain files.