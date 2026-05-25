import { describe, expect, test, vi } from "vitest";
import { fetchImagePayload } from "../src/background/images";

describe("image fetch pipeline", () => {
  test("converts fetched image bytes into an image payload", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-type": "image/png" } }));

    const payload = await fetchImagePayload("https://example.com/image.png", fetcher);

    expect(fetcher).toHaveBeenCalledWith("https://example.com/image.png");
    expect(payload).toEqual({
      dataUrl: "data:image/png;base64,AQID",
      mimeType: "image/png",
      base64: "AQID"
    });
  });

  test("rejects non-image responses with a Korean message", async () => {
    const fetcher = vi.fn(async () => new Response("not image", { headers: { "content-type": "text/html" } }));

    await expect(fetchImagePayload("https://example.com/page", fetcher)).rejects.toThrow("이미지 파일이 아닙니다");
  });
});
