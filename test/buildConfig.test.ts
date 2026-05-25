import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appConfig = readFileSync(resolve("vite.config.ts"), "utf8");
const contentScriptConfig = readFileSync(resolve("vite.content.config.ts"), "utf8");
const packageJson = readFileSync(resolve("package.json"), "utf8");
const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8")) as {
  content_scripts?: Array<{ world?: string }>;
};

describe("extension build configuration", () => {
  test("builds the content script as a classic self-contained file", () => {
    expect(normalizePath(contentScriptConfig)).toContain('resolve(rootDir, "src/contentScript.ts")');
    expect(contentScriptConfig).toContain("emptyOutDir: false");
    expect(contentScriptConfig).toContain('format: "iife"');
    expect(contentScriptConfig).toContain("inlineDynamicImports: true");
    expect(contentScriptConfig).toContain('entryFileNames: "contentScript.js"');
    expect(packageJson).toContain("vite build --config vite.content.config.ts");
    expect(packageJson).toContain("verify-content-script.cjs");
  });

  test("does not include the content script in the shared app build", () => {
    expect(appConfig).not.toContain("src/contentScript.ts");
  });

  test("builds the dictionary page as an extension app page", () => {
    expect(appConfig).toContain("dictionary: resolve(rootDir, \"dictionary.html\")");
  });

  test("loads manifest content scripts in the isolated extension world", () => {
    expect(manifest.content_scripts?.[0]?.world).toBe("ISOLATED");
  });
});

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
