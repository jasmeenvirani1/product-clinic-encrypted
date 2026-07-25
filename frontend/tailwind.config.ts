import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-plus-jakarta)", "sans-serif"],
        body:    ["var(--font-dm-sans)", "sans-serif"],
        sans:    ["var(--font-dm-sans)", "sans-serif"],
      },
      colors: {
        // Use space-separated RGB vars so Tailwind opacity modifiers work:
        // e.g. bg-primary/10 → rgb(var(--color-primary-rgb-space) / 0.1)
        primary: {
          DEFAULT: "rgb(var(--color-primary-rgb-space) / <alpha-value>)",
          dark:    "rgb(var(--color-primary-dark-rgb-space) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
        },
        brand: {
          bg:      "var(--color-brand-bg)",
          card:    "#FFFFFF",
          border:  "var(--color-brand-border)",
          heading: "var(--color-brand-heading)",
        },
        success: {
          DEFAULT: "var(--color-success)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
        },
        error: {
          DEFAULT: "var(--color-error)",
        },
        sidebar: {
          DEFAULT: "var(--color-sidebar-bg)",
          hover:   "var(--color-sidebar-hover)",
          active:  "var(--color-sidebar-active)",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
