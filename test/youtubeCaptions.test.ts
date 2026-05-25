import { describe, expect, test } from "vitest";
import {
  createNumberedCaptionBatches,
  extractCaptionTracksFromPlayerResponse,
  mergeCaptionFragmentsIntoSentences,
  parseCaptionResponse,
  parseNumberedCaptionResponse,
  renderYouTubeCaptionOverlay
} from "../src/content/youtubeCaptions";

describe("YouTube caption helpers", () => {
  test("extracts caption tracks with English tracks first", () => {
    const tracks = extractCaptionTracksFromPlayerResponse({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { baseUrl: "https://example.com/ko", languageCode: "ko", name: { simpleText: "Korean" } },
            { baseUrl: "https://example.com/en", languageCode: "en", name: { simpleText: "English" } }
          ]
        }
      }
    });

    expect(tracks.map((track) => track.languageCode)).toEqual(["en", "ko"]);
    expect(tracks[0]?.name).toBe("English");
    expect(tracks[0]?.id).toBeTruthy();
  });

  test("parses json3 and xml timed text caption responses", () => {
    const json = parseCaptionResponse(
      JSON.stringify({
        events: [
          { tStartMs: 1000, dDurationMs: 1200, segs: [{ utf8: "Hello " }, { utf8: "world." }] },
          { tStartMs: 2500, dDurationMs: 900, segs: [{ utf8: "\n" }] }
        ]
      }),
      "application/json"
    );
    const xml = parseCaptionResponse(
      '<transcript><text start="1.5" dur="2">Good &amp; nice.</text></transcript>',
      "text/xml"
    );

    expect(json).toEqual([{ text: "Hello world.", startMs: 1000, endMs: 2200 }]);
    expect(xml).toEqual([{ text: "Good & nice.", startMs: 1500, endMs: 3500 }]);
  });

  test("merges caption fragments into sentence timed entries", () => {
    const sentences = mergeCaptionFragmentsIntoSentences([
      { text: "Hello", startMs: 0, endMs: 800 },
      { text: "world.", startMs: 850, endMs: 1500 },
      { text: "Next sentence.", startMs: 1600, endMs: 2600 }
    ]);

    expect(sentences).toEqual([
      { id: "caption-1", text: "Hello world.", startMs: 0, endMs: 1500 },
      { id: "caption-2", text: "Next sentence.", startMs: 1600, endMs: 2600 }
    ]);
  });

  test("creates numbered batches and parses numbered responses", () => {
    const sentences = [
      { id: "caption-1", text: "Hello world.", startMs: 0, endMs: 1500 },
      { id: "caption-2", text: "Next sentence.", startMs: 1600, endMs: 2600 }
    ];
    const batches = createNumberedCaptionBatches(sentences, 100);
    const parsed = parseNumberedCaptionResponse("1. 안녕하세요.\n2. 다음 문장입니다.", batches[0]);

    expect(batches).toHaveLength(1);
    expect(batches[0]?.content).toBe("1. Hello world.\n2. Next sentence.");
    expect(parsed).toEqual([
      { id: "caption-1", text: "안녕하세요." },
      { id: "caption-2", text: "다음 문장입니다." }
    ]);
  });

  test("renders and updates the youtube caption overlay position", () => {
    const player = document.createElement("div");
    document.body.append(player);

    const overlay = renderYouTubeCaptionOverlay(player, "below", "번역 자막");
    const updated = renderYouTubeCaptionOverlay(player, "above", "위 번역");

    expect(overlay).toBe(updated);
    expect(updated.dataset.aiTranslatorYoutubeCaption).toBe("true");
    expect(updated.dataset.position).toBe("above");
    expect(updated.textContent).toBe("위 번역");
  });
});
