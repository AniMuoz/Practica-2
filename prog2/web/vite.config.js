import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Agrega aqui tu dominio de Cloudflare (el punto inicial permite subdominios).
    allowedHosts: [".trycloudflare.com", ".TUDOMINIO.com"],
    proxy: {
      "/api": {
        target: env.API || "http://localhost:3001",
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes, req) => {
            if (req.url.startsWith("/api/eventos")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
    },
  };
});
