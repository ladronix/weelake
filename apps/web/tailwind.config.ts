import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Water gradient (primary brand)
        water: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          200: "#BAE6FD",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C4A6E",
          950: "#082F49",
        },
        // Temperature scale — Windy-inspired
        temp: {
          freezing: "#1E3A8A", // < 5°C
          cold: "#3B82F6",     // 5-10°C
          cool: "#22D3EE",     // 10-15°C
          mild: "#10B981",     // 15-18°C
          warm: "#FACC15",     // 18-22°C
          hot: "#F59E0B",      // 22-26°C
          burning: "#EF4444",  // 26-30°C
          extreme: "#7C2D12",  // > 30°C
        },
        // Semantic
        surface: "#F8FAFC",
        deep: "#0F172A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "wave": "wave 3s ease-in-out infinite",
        "ripple": "ripple 1.6s ease-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "water-gradient": "linear-gradient(135deg, #0EA5E9 0%, #0369A1 50%, #082F49 100%)",
        "water-mesh": "radial-gradient(at 20% 20%, #38BDF8 0px, transparent 50%), radial-gradient(at 80% 30%, #0EA5E9 0px, transparent 50%), radial-gradient(at 40% 80%, #0369A1 0px, transparent 50%)",
        "glass": "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
      },
    },
  },
  plugins: [],
};

export default config;
