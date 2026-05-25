import { describe, expect, test } from "vitest";
import {
  applyHtmlTranslationPatches,
  collectTranslatableTextNodes,
  createHtmlTranslationPatches,
  replaceTextNodes,
  restoreTextNodes
} from "../src/content/domTranslator";

describe("DOM page translator", () => {
  test("collects visible text nodes and skips unsafe/editable areas", () => {
    document.body.innerHTML = `
      <main>
        <p>Hello <strong>world</strong></p>
        <script>const ignored = true;</script>
        <style>.ignored { color: red; }</style>
        <textarea>Ignore me</textarea>
        <div contenteditable="true">Ignore editable</div>
      </main>
    `;

    const nodes = collectTranslatableTextNodes(document.body);

    expect(nodes.map((node) => node.textContent?.trim()).filter(Boolean)).toEqual(["Hello", "world"]);
  });

  test("replaces and restores collected text nodes", () => {
    document.body.innerHTML = `<p>Hello <span>world</span></p>`;
    const nodes = collectTranslatableTextNodes(document.body);
    const originals = replaceTextNodes(nodes, ["안녕", "세계"]);

    expect(nodes.map((node) => node.textContent)).toEqual(["안녕", "세계"]);

    restoreTextNodes(originals);

    expect(nodes.map((node) => node.textContent)).toEqual(["Hello ", "world"]);
  });

  test("creates HTML translation patches without unsafe nodes", () => {
    document.body.innerHTML = `
      <main>
        <h1>Hello world</h1>
        <p>This is <strong>important</strong>.</p>
        <script>const ignored = true;</script>
        <style>.ignored { color: red; }</style>
        <textarea>Ignore me</textarea>
      </main>
    `;

    const nodes = collectTranslatableTextNodes(document.body);
    const patches = createHtmlTranslationPatches(nodes, 600);

    expect(patches.length).toBe(1);
    expect(patches[0].html).toContain("<ai-translator-page>");
    expect(patches[0].html).toContain('data-ai-translator-text-id="t1"');
    expect(patches[0].html).toContain("Hello world");
    expect(patches[0].html).toContain("important");
    expect(patches[0].html).not.toContain("ignored");
    expect(patches[0].html).not.toContain("Ignore me");
    expect(patches[0].items.map((item) => item.originalText.trim()).filter(Boolean)).toEqual([
      "Hello world",
      "This is",
      "important",
      "."
    ]);
  });

  test("applies translated HTML patches by id and keeps missing ids unchanged", () => {
    document.body.innerHTML = `<main><h1>Hello</h1><p>World</p></main>`;
    const nodes = collectTranslatableTextNodes(document.body);
    const patches = createHtmlTranslationPatches(nodes);

    const replacements = applyHtmlTranslationPatches(patches, [
      `
        <ai-translator-page>
          <ai-t data-ai-translator-text-id="t1">안녕</ai-t>
        </ai-translator-page>
      `
    ]);

    expect(nodes.map((node) => node.textContent)).toEqual(["안녕", "World"]);

    restoreTextNodes(replacements);

    expect(nodes.map((node) => node.textContent)).toEqual(["Hello", "World"]);
  });
});
