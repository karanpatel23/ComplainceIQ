import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F4EE",
        porcelain: "#FFFCF7",
        graphite: "#16202B",
        steel: "#E5EAF0",
        slateblue: "#3F5F78",
        brass: "#B58345",
        copper: "#A96D3A",
        smoke: "#66717D",
        line: "#D8D0C5",
        ink: "#101820",
      },
      fontFamily: {
        sans: ["Inter", "Manrope", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        editorial: "0 28px 70px rgba(22,32,43,.14)",
        metal: "0 1px 0 rgba(255,255,255,.75) inset, 0 24px 50px rgba(63,95,120,.16)",
      },
      backgroundImage: {
        blueprint: "linear-gradient(rgba(63,95,120,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(63,95,120,.08) 1px, transparent 1px)",
        brushed: "linear-gradient(135deg, rgba(255,255,255,.86), rgba(229,234,240,.5) 42%, rgba(181,131,69,.10))",
      },
    },
  },
  plugins: [],
};

export default config;
