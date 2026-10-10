import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api to the backend, so cookies and images are same-origin (no CORS headaches).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { "/api": { target: env.VITE_API_TARGET || "http://localhost:3000", changeOrigin: false } } },
  };
});
