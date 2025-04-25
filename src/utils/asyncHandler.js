const asyncHandler = (requestHandler)=>{
    return (req,res,next) =>{
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
    }
}



export {asyncHandler}




// // ✅ Approach 1: Using Promise.resolve().catch()
// // This version uses a higher-order function to catch errors from async route handlers.
// // It wraps the handler and ensures any rejected promise is caught and passed to Express's error handler via next().
// const asyncHandler = (requestHandler) => {
//     return (req, res, next) => {
//       Promise
//         .resolve(requestHandler(req, res, next))
//         .catch((err) => next(err));
//     };
//   };

//   // ✅ Approach 2: Using async/await and try-catch block directly
//   // This is another way of writing the same thing. It provides more control if you want to customize error responses.
//   const asyncHandlerVerbose = (fn) => {
//     return async (req, res, next) => {
//       try {
//         await fn(req, res, next);
//       } catch (error) {
//         // Optionally customize the error response here
//         res.status(error.code || 500).json({
//           success: false,
//           message: error.message,
//         });
//       }
//     };
//   };

//   export { asyncHandler, asyncHandlerVerbose };


//   /* 
//   🧠 What's happening here?

//   1️⃣ asyncHandler is a **higher-order function**:
//      - A higher-order function is a function that accepts another function as an argument and/or returns a function.
//      - This makes it great for wrapping logic around other functions, like error handling around route handlers.

//   2️⃣ Problem it solves:
//      - In Express, when an async function throws an error (or rejects a promise), you must manually call `next(error)` to let Express handle it.
//      - If you forget, the server crashes or hangs, and your error middleware won't catch it.
//      - Instead of writing `try/catch` in every route, we use a reusable asyncHandler to do that for us.

//   Example without asyncHandler:
//   ```js
//   app.get("/route", async (req, res, next) => {
//     try {
//       const data = await somethingAsync();
//       res.json(data);
//     } catch (error) {
//       next(error); // must manually call this
//     }
//   });


//higher order function are functions which can accept functions as parameter and returned an enhanced version of that function 

// trying to understand what we are doing
// const asyncHandler = (func) => {}
// const asyncHandler = (func) => ()=>{}
// const asyncHandler = (func) => async () => {}

//we are basically making a wrapper function that we are gonna use

// const asyncHandler = (fn)=> async (req,res,next)=>{ 
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success : false,
//             message: error.message
//         })
//     }
// }