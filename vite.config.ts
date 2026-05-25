import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(rootDir, "popup.html"),
        options: resolve(rootDir, "options.html"),
        translator: resolve(rootDir, "translator.html"),
        tutorial: resolve(rootDir, "tutorial.html"),
        background: resolve(rootDir, "src/background.ts"),
        contentScript: resolve(rootDir, "src/contentScript.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
