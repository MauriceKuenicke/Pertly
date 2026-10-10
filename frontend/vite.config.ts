import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the FastAPI backend runs on :8000 (`make dev-backend`);
// proxying /api keeps the browser on a single origin, exactly like the
// nginx setup in production, so session cookies and the CSRF header work
// identically in both.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
