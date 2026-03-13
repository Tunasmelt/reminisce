import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Reminisce Design System
        reminisce: {
          bg: {
            base: 'var(--bg-base)',
            surface: 'var(--bg-surface)',
            card: 'var(--bg-card)',
            elevated: 'var(--bg-elevated)',
          },
          border: {
            subtle: 'var(--border-subtle)',
            default: 'var(--border-default)',
          },
          accent: {
            primary: 'var(--accent-primary)',
            'primary-hover': 'var(--accent-primary-hover)',
            purple: 'var(--accent-purple)',
            green: 'var(--accent-green)',
            blue: 'var(--accent-blue)',
          },
          text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
          },
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'rem-sm': 'var(--radius-sm)',
        'rem-md': 'var(--radius-md)',
        'rem-lg': 'var(--radius-lg)',
        'rem-xl': 'var(--radius-xl)',
        'rem-pill': 'var(--radius-pill)',
      },
      fontSize: {
        'rem-xs': 'var(--text-xs)',
        'rem-sm': 'var(--text-sm)',
        'rem-base': 'var(--text-base)',
        'rem-lg': 'var(--text-lg)',
        'rem-xl': 'var(--text-xl)',
        'rem-2xl': 'var(--text-2xl)',
        'rem-3xl': 'var(--text-3xl)',
        'rem-4xl': 'var(--text-4xl)',
        'rem-5xl': 'var(--text-5xl)',
        'rem-6xl': 'var(--text-6xl)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
