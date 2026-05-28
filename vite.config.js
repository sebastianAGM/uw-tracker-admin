import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  base: "./",

  plugins: [react()],

  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },

  server: {
    host: true,
    port: 5173,

    proxy: {
      "/api": {
        target: "https://uw-backend.sebastian-gonzalez243.workers.dev",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});