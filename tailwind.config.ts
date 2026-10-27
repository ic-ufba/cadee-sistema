import type { Config } from "tailwindcss";

/* CADEE — identidade "Bahia editorial".
   Tokens semânticos vêm de src/index.css. As paletas padrão do Tailwind
   (blue, green, purple, amber…) que já aparecem espalhadas no código foram
   remapeadas para as cores da identidade, pelo significado:
     blue/sky/cyan/indigo/green/emerald/teal/lime → mar   (obrigatória, cursada, ok)
     purple/violet/fuchsia/orange/amber           → dendê (optativa, disponível, aviso)
     yellow                                       → ouro  (complementar, destaque)
     red/rose/pink                                → pitanga (erro, lotado, destrutivo)
     gray/slate/zinc/neutral/stone                → neutros quentes (carvão → névoa)
   Assim nenhuma classe some e nenhum componente precisa mudar de lógica. */
const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

const mar = {
  50: "#E6F2F1", 100: "#D5EAE8", 200: "#B0D8D6", 300: "#7FBFBD", 400: "#3FA0A3",
  500: "#00838C", 600: "#00727B", 700: "#005F67", 800: "#005159", 900: "#003F45", 950: "#002A2E",
};
const dende = {
  50: "#FFF1E7", 100: "#FBDFCB", 200: "#F8C6A2", 300: "#F4A673", 400: "#F1874A",
  500: "#EE6A1F", 600: "#D2560F", 700: "#A8440B", 800: "#8A3A0B", 900: "#6B2E0A", 950: "#3D1904",
};
const ouro = {
  50: "#FEF8E1", 100: "#FDEFC0", 200: "#FBE08A", 300: "#F8CF4E", 400: "#F5C21F",
  500: "#F2B705", 600: "#CC9A04", 700: "#A37A03", 800: "#7D5D04", 900: "#5C4505", 950: "#362802",
};
const pitanga = {
  50: "#FCEDEB", 100: "#F6D5D1", 200: "#EDB0A9", 300: "#E2857B", 400: "#D65A4E",
  500: "#C8342B", 600: "#AE2B23", 700: "#8E1F18", 800: "#731A14", 900: "#5A1611", 950: "#330B08",
};
const neutro = {
  50: "#F8F7F4", 100: "#F3F1EC", 200: "#E8E5DE", 300: "#D6D2C9", 400: "#A8A297",
  500: "#8C857A", 600: "#6E675D", 700: "#4F4A43", 800: "#34312C", 900: "#1C1B19", 950: "#111111",
};

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Montserrat", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"Red Hat Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        background: c("background"),
        foreground: { DEFAULT: c("foreground"), 2: c("foreground-2") },
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        secondary: { DEFAULT: c("secondary"), foreground: c("secondary-foreground") },
        destructive: { DEFAULT: c("destructive"), foreground: c("destructive-foreground") },
        success: { DEFAULT: c("success"), foreground: c("success-foreground") },
        warning: { DEFAULT: c("warning"), foreground: c("warning-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        popover: { DEFAULT: c("popover"), foreground: c("popover-foreground") },
        card: { DEFAULT: c("card"), foreground: c("card-foreground") },
        sidebar: {
          DEFAULT: c("sidebar-background"),
          foreground: c("sidebar-foreground"),
          primary: c("sidebar-primary"),
          "primary-foreground": c("sidebar-primary-foreground"),
          accent: c("sidebar-accent"),
          "accent-foreground": c("sidebar-accent-foreground"),
          border: c("sidebar-border"),
          ring: c("sidebar-ring"),
        },

        /* identidade */
        nevoa: c("nevoa"),
        trilho: c("trilho"),
        tracejado: c("tracejado"),
        areia: c("areia"),
        mar: { DEFAULT: c("mar"), tint: c("mar-tint"), ink: c("mar-ink"), claro: c("mar-claro") },
        dende: { DEFAULT: c("dende"), tint: c("dende-tint"), ink: c("dende-ink"), claro: c("dende-claro") },
        ouro: c("ouro"),
        pedra: c("pedra"),
        pitanga: { DEFAULT: c("pitanga"), tint: c("pitanga-tint"), ink: c("pitanga-ink") },
        dock: { DEFAULT: c("dock"), ativo: c("dock-ativo"), "ativo-fg": c("dock-ativo-fg"), icone: c("dock-icone") },
        overlay: c("overlay"),

        /* paletas padrão remapeadas (ver comentário no topo) */
        blue: mar, sky: mar, cyan: mar, indigo: mar, green: mar, emerald: mar, teal: mar, lime: mar,
        purple: dende, violet: dende, fuchsia: dende, orange: dende, amber: dende,
        yellow: ouro,
        red: pitanga, rose: pitanga, pink: pitanga,
        gray: neutro, slate: neutro, zinc: neutro, neutral: neutro, stone: neutro,
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        /* superfície contínua: cartões sem sombra */
        'card': 'none',
        'card-hover': 'none',
        'elevated': '0 18px 48px -12px rgb(28 27 25 / 0.25)',
        'sm': 'none',
        'md': '0 8px 24px -8px rgb(28 27 25 / 0.16)',
        'lg': '0 12px 32px -8px rgb(28 27 25 / 0.18)',
        'xl': '0 18px 48px -12px rgb(28 27 25 / 0.25)',
        'dock': '0 12px 32px rgb(28 27 25 / 0.22)',
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
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-in-bottom": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        gira: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-bottom": "slide-in-bottom 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "scale-in": "scale-in 0.2s ease-out",
        gira: "gira 0.9s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
