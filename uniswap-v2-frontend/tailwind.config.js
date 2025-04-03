/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FF007A",
        secondary: "#2172E5",
        dark: "#191B1F",
        light: "#2C2F36",
        lighter: "#40444F",
      },
    },
  },
  plugins: [],
}

