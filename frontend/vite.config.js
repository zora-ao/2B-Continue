import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/components/ui/button" → "src/components/ui/button"
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    // Forward /api calls to Flask during development.
    // Use another backend with: API_URL=http://127.0.0.1:5001 npm run dev
    proxy: {
      "/api": process.env.API_URL || "http://127.0.0.1:5000",
    },
  },
});
