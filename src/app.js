import express from 'express'
import cors from "cors"
import cookieParser from 'cookie-parser'

const app = express()

// --------------------- 📌 GLOBAL MIDDLEWARE CONFIGS -------------------------

// Middleware functions are functions that execute during the lifecycle of a request to the server.
// They're used for modifying request/response objects, ending the request-response cycle, etc.

// ✅ CORS Middleware - Enables Cross-Origin Resource Sharing
// When your frontend and backend are on different domains or ports (e.g., Vite on 5173, API on 3000),
// the browser blocks requests by default due to security.
// CORS lets us define which domains are allowed to talk to the server.

app.use(cors({
    origin: process.env.CORS_ORIGIN,  // e.g., http://localhost:5173 or your deployed frontend domain
    credentials: true                 // allows cookies to be included in cross-origin requests (important for login sessions)
}))

// ✅ express.json() - Parses incoming JSON payloads
// All API request bodies sent in JSON format (e.g., from a frontend POST request) need to be parsed.
// We set a limit to protect the server from too large JSON inputs (DoS attack prevention).

app.use(express.json({
    limit: "16kb" // limit size of request body
}))

// ✅ express.urlencoded() - Parses incoming URL-encoded form data
// Useful when you're submitting HTML forms with URL-encoded bodies (like input name=value).
// 'extended: true' allows for nested object support in URL encoding.

app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))

// ✅ express.static() - Serves static files like images, PDFs, etc.
// If you store user-uploaded assets, logos, PDFs, etc., put them in the "public" folder.
// You can then access them via URL without creating a special route.

app.use(express.static("public"))

// ✅ cookieParser() - Parses Cookie header and populates req.cookies object
// Used to access cookies sent by the client in every request (like session tokens).
// Essential for authentication systems where login info is stored in cookies.

app.use(cookieParser())

/*
🍪 WHAT ARE COOKIES?

- Cookies are small pieces of data stored by the browser and sent along with every request to the same domain.
- Commonly used for authentication (storing tokens like JWT), session management, and preferences.
- When you set `credentials: true` in CORS and use cookieParser, you're allowing your backend to read cookies and manage sessions properly.

🧠 Why are all these configs used?

1. Securely allow communication between frontend and backend (CORS).
2. Properly parse incoming data whether it’s JSON or from forms (body parsing).
3. Serve public assets like images.
4. Handle cookies for session-based authentication or tracking.

This makes the server ready to handle real-world production scenarios.
*/

export { app }
