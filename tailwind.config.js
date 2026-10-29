/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        brand: '#5CE1E6'
      }
    },
  },
  plugins: [],
}
