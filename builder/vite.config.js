import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // daily-js is one legitimately large chunk; hush Vite's 500kB grumble so
    // real problems stand out in build logs.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    // When running the UI alone (npm run dev:ui), proxy /api to `vercel dev`
    // running on 3000 so persona generation still works.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
