import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages deploys to https://<username>.github.io/<repo-name>/
// Set VITE_BASE_URL env var OR update `base` below with your repo name.
// For user/org pages (username.github.io), use base: "/"
const base = process.env.VITE_BASE_URL ?? "/aegis-nova/";

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    target: "esnext",
    rollupOptions: {
      output: {
        // Chunk splitting for optimal caching
        manualChunks: {
          react:   ["react", "react-dom"],
          motion:  ["framer-motion"],
          lucide:  ["lucide-react"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["react", "react-dom", "framer-motion", "lucide-react"],
  },
});
