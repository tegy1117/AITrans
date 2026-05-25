import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: "dist",
    rollupOptions: {
      input: resolve(rootDir, "src/contentScript.ts"),
      output: {
        format: "iife",
        name: "AITranslatorContentScript",
        entryFileNames: "contentScript.js",
        inlineDynamicImports: true,
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
