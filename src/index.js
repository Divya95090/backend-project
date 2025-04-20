





























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