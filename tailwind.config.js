/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors can be added here
      },
      fontFamily: {
        // Custom fonts can be added here
      }
    },
  },
  plugins: [],
} 