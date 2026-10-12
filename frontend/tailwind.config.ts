import type { Config } from "tailwindcss";

// Every colour comes from a CSS variable in app/globals.css (space-separated RGB),
// so the whole palette can change in one place and opacity modifiers still work.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: { DEFAULT: token("surface"), raised: token("surface-raised") },
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        subtle: token("subtle"),
        accent: { DEFAULT: token("accent"), soft: token("accent-soft"), fg: token("accent-fg") },
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        info: token("info"),
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      borderRadius: { xl: "1rem", "2xl": "1.25rem", "3xl": "1.5rem" },
      boxShadow: {
        card: "0 1px 0 0 rgb(var(--fg) / 0.04) inset, 0 20px 40px -24px rgb(0 0 0 / 0.8)",
        glow: "0 8px 30px -8px rgb(var(--accent) / 0.55)",
      },
      keyframes: {
        "toast-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: { "toast-in": "toast-in 0.2s ease-out", "fade-in": "fade-in 0.15s ease-out" },
    },
  },
  plugins: [],
};
export default config;
