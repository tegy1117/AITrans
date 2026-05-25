import { describe, expect, test, vi } from "vitest";
import { createPageHtmlPatchPrompt, translatePageHtmlPatches, translatePageTexts } from "../src/background/pageTranslation";

describe("page translation request scheduling", () => {
  test("translates page text sequentially to avoid provider concurrent request limits", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await translatePageTexts(["one", "two", "three"], async (text) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return `translated ${text}`;
    });

    expect(results).toEqual(["translated one", "translated two", "translated three"]);
    expect(maxInFlight).toBe(1);
  });

  test("retries transient 429 provider errors before failing the page batch", async () => {
    const delay = vi.fn(async () => undefined);
    let attempts = 0;

    const results = await translatePageTexts(
      ["one"],
      async (text) => {
        attempts += 1;
        if (attempts === 1) throw new Error('Provider request failed with HTTP 429: {"error":"too many concurrent requests"}');
        return `translated ${text}`;
      },
      { maxRetries: 1, retryDelayMs: 5, delay }
    );

    expect(results).toEqual(["translated one"]);
    expect(delay).toHaveBeenCalledWith(5);
  });

  test("translates HTML patches with one provider call per patch", async () => {
    const inputs: string[] = [];

    const results = await translatePageHtmlPatches(
      [
        '<ai-translator-page><ai-t data-ai-translator-text-id="t1">Hello</ai-t></ai-translator-page>',
        '<ai-translator-page><ai-t data-ai-translator-text-id="t2">World</ai-t></ai-translator-page>'
      ],
      async (content) => {
        inputs.push(content);
        return content.slice(content.indexOf("<ai-translator-page>")).replace("Hello", "안녕").replace("World", "세계");
      }
    );

    expect(results).toEqual([
      '<ai-translator-page><ai-t data-ai-translator-text-id="t1">안녕</ai-t></ai-translator-page>',
      '<ai-translator-page><ai-t data-ai-translator-text-id="t2">세계</ai-t></ai-translator-page>'
    ]);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toContain("태그 구조와 속성");
    expect(inputs[0]).toContain('data-ai-translator-text-id="t1"');
  });

  test("creates a strict HTML patch prompt", () => {
    const prompt = createPageHtmlPatchPrompt('<ai-t data-ai-translator-text-id="t1">Hello</ai-t>');

    expect(prompt).toContain("<ai-t>");
    expect(prompt).toContain("HTML만 반환");
    expect(prompt).toContain('data-ai-translator-text-id="t1"');
  });
});
