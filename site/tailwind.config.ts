import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f8fafc",
        text: "#0f172a",
        muted: "rgba(15, 23, 42, 0.66)",
        border: "rgba(15, 23, 42, 0.14)",
        surface: "rgba(255, 255, 255, 0.86)",
        "surface-strong": "rgba(255, 255, 255, 0.96)",
        accent: "#2563eb",
        "accent-ink": "#1d4ed8"
      },
      fontFamily: {
        sans: [
          "IBM Plex Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "sans-serif"
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace"
        ]
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        lg: "16px",
        full: "999px"
      },
      boxShadow: {
        sm: "0 1px 0 rgba(15, 23, 42, 0.06), 0 12px 34px rgba(15, 23, 42, 0.06)",
        md: "0 1px 0 rgba(15, 23, 42, 0.06), 0 22px 60px rgba(15, 23, 42, 0.1)",
        primary: "0 1px 0 rgba(15, 23, 42, 0.05), 0 18px 46px rgba(37, 99, 235, 0.18)"
      },
      maxWidth: {
        container: "1120px"
      },
      animation: {
        "fade-up": "fadeUp 520ms ease-out both"
      },
      keyframes: {
        fadeUp: {
          from: {
            opacity: "0",
            transform: "translateY(10px)"
          },
          to: {
            opacity: "1",
            transform: "translateY(0)"
          }
        }
      }
    }
  },
  plugins: []
};

export default config;
