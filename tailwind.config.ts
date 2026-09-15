import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        "tv-hd": "1366px",
        tv: "1920px",
        "tv-4k": "2560px",
      },
      colors: {
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        emerald: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          '"Plus Jakarta Sans"',
          '"Segoe UI"',
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Outfit",
          "var(--font-sans)",
          "sans-serif",
        ],
        tv: ["var(--font-tv-sans)", "system-ui", "sans-serif"],
        "tv-mono": ["var(--font-tv-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 12px 40px -18px rgba(12, 42, 50, 0.38)",
        nav: "0 8px 20px -8px rgba(13, 148, 136, 0.45)",
      },
      animation: {
        "tv-pulse-glow": "tv-pulse-glow 4s ease-in-out infinite",
        "tv-shimmer": "tv-shimmer 2.2s ease-in-out infinite",
        "tv-float": "tv-float 8s ease-in-out infinite",
      },
      keyframes: {
        "tv-pulse-glow": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.85" },
        },
        "tv-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "tv-float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
