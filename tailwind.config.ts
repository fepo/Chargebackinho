import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dce7ff",
          500: "#3b5bdb",
          600: "#2f4ac5",
          700: "#2540ae",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
