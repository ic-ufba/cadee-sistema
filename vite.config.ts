import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Em desenvolvimento, /sigaa-api vai para a {sigaa} api local (docker compose up -d no repositório dela).
    // Use VITE_SIGAA_API_URL=/sigaa-api no .env.local. Assim não precisa de CORS e o login funciona sem HTTPS.
    proxy: {
      "/sigaa-api": {
        target: process.env.SIGAA_API_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sigaa-api/, ""),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      'framer-motion': path.resolve(__dirname, './node_modules/framer-motion')
    },
  },
  optimizeDeps: {
    include: ['framer-motion'],
    exclude: []
  }
}));
