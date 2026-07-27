import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#FFFFFF",
          body: "#F4F7F9", // Слегка серо-голубой фон, чтобы белое стекло выделялось
          text: {
            primary: "#0F172A",
            secondary: "#64748B",
            muted: "#94A3B8",
          },
          accent: {
            DEFAULT: "#4F46E5", // Более дорогой цвет индиго
            hover: "#4338CA",
            light: "#EEF2FF",
          },
          border: {
            soft: "rgba(226, 232, 240, 0.6)", // Полупрозрачные бордеры для стекла
            light: "rgba(241, 245, 249, 0.8)",
          },
        },
      },
      boxShadow: {
        glass: "0 4px 30px rgba(0, 0, 0, 0.03)",
        "premium-card": "0 10px 30px -5px rgba(15, 23, 42, 0.08)",
        modal: "0 20px 40px -10px rgba(15, 23, 42, 0.1)",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "sans-serif"],
        display: ["var(--font-outfit)", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        livePulse: "pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;