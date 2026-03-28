/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6366f1",
          light:   "#818cf8",
          dark:    "#4f46e5",
        },
      },
      fontFamily: {
        sans:  ["'DM Sans'", "system-ui", "sans-serif"],
        syne:  ["'Syne'", "sans-serif"],
        mono:  ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
