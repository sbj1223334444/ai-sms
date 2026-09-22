import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        slate1: "#64748B",
        line: "#E4E8EF",
        surface: "#F4F6FA",
        chart: "#E30A17",
        chartdark: "#B00812",
        chartsoft: "#FEF2F2",
        navy: "#0B1B34",
        risk: {
          red: "#DC2626",
          orange: "#EA580C",
          yellow: "#D69E08",
          green: "#16A34A"
        },
        brand: "#E30A17"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        lift: "0 10px 30px -12px rgba(15, 23, 42, 0.25)",
        xs: "0 1px 2px rgba(15, 23, 42, 0.05)"
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem"
      }
    }
  },
  plugins: []
};
export default config;
