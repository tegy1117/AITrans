import { describe, expect, test } from "vitest";
import { collectTranslatableTextNodes, replaceTextNodes, restoreTextNodes } from "../src/content/domTranslator";

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
});
