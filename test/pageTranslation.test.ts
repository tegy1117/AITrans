import { describe, expect, test, vi } from "vitest";
import { translatePageTexts } from "../src/background/pageTranslation";

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
});
