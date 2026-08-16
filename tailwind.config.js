/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontFamily: {
      sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      serif: ['var(--font-serif)', 'Georgia', 'serif'],
    },
    extend: {
      colors: {
        // ── Modern Editorial semantic system (design handoff README) ──
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          ink: "var(--accent-ink)",
        },
        "on-accent": "var(--on-accent)",
        success: {
          DEFAULT: "var(--success)",
          ink: "var(--success-ink)",
        },
        "on-success": "var(--on-success)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        scrim: "var(--scrim)",
        focus: "var(--focus)",
        stage: {
          ink: "var(--stage-ink)",
          "ink-muted": "var(--stage-ink-muted)",
          "ink-tertiary": "var(--stage-ink-tertiary)",
          amber: "var(--stage-amber)",
          dock: "var(--stage-dock)",
          hairline: "var(--stage-hairline)",
        },
        "on-stage-amber": "var(--on-stage-amber)",
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // ── DEPRECATED legacy shadcn mappings (unmigrated components) ──
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        "legacy-accent": {
          DEFAULT: "hsl(var(--legacy-accent))",
          foreground: "hsl(var(--legacy-accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        // Radius has meaning: covers are books (5px), controls 10, cards 14,
        // sheets 20. rounded-2xl is banned in migrated components.
        cover: "var(--r-cover)",
        control: "var(--r-control)",
        card: "var(--r-card)",
        sheet: "var(--r-sheet)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        e1: "var(--e-1)",
        e2: "var(--e-2)",
        e3: "var(--e-3)",
        cover: "var(--shadow-cover)",
      },
      zIndex: {
        nav: "var(--z-nav)",
        sheet: "var(--z-sheet)",
        takeover: "var(--z-takeover)",
        toast: "var(--z-toast)",
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
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
