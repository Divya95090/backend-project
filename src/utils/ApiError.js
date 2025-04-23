// ✅ Custom Error Class for API Errors

class ApiError extends Error {
constructor(
statusCode,                 // HTTP status code (e.g., 404, 500, etc.)
message = "Something went wrong", // Default error message
errors = [],                // Additional error details (like validation errors)
stack = ""                  // Optional: manually provide stack trace if needed
) {
super(message); // 🔹 Calls parent (Error) constructor with the message

// 🔸 Custom fields for more structured error handling
this.statusCode = statusCode;  // HTTP status code
this.data = null;              // Optional: you can attach extra data later if needed
this.message = message;        // Custom error message
this.success = false;          // By default, API error means operation failed
this.errors = errors;          // Array of detailed errors (like form validations)

// 🔸 Stack trace handling
if (stack) {
    // If a custom stack trace is passed, use it
    this.stack = stack;
} else {
    // Otherwise, capture the stack trace for this specific class context
    Error.captureStackTrace(this, this.constructor);
    /*
    🔍 Error.captureStackTrace():
    - Built-in Node.js function that creates a `.stack` property for better debugging
    - `this` refers to the current error instance
    - `this.constructor` makes sure stack starts from where ApiError was created
    */
}
}
}

export { ApiError };


/*
🧠 Why create a custom error class?

1️⃣ More control:
- Allows you to define standard structure for all your API errors.
- Easy to send consistent responses across your app.

2️⃣ Useful in error-handling middleware:
- When an error is thrown from anywhere in your app, you can check if it's an instance of ApiError and respond accordingly.

📦 Typical response structure using ApiError might look like:

{
success: false,
message: "User not found",
statusCode: 404,
errors: [],
data: null
}

🚀 Example usage:
throw new ApiError(404, "User not found");

🎯 Pro Tip:
- Use it along with `asyncHandler` to throw clean, traceable errors inside async routes/services.
*/


/*
Why this.data is it there?  It’s not being used yet, but it’s reserved for possible future use.

Sometimes, when an error occurs, you might want to return more than just a message. You might want to give:

Some contextual data about the failure

The resource that failed

Some user-specific info

Or even debug values (in dev mode)

That's where this.data can be helpful.
*/