import { describe, expect, test, vi } from "vitest";
import { isYouTubeWatchUrl, renderYouTubeCaptionControls } from "../src/popup/youtubeCaptions";
import type { YouTubeCaptionTrack } from "../src/shared/types";

describe("popup youtube caption controls", () => {
  test("detects youtube watch urls", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeWatchUrl("https://www.youtube.com/shorts/abc")).toBe(false);
    expect(isYouTubeWatchUrl("https://example.com/watch?v=abc")).toBe(false);
  });

  test("renders disabled guidance outside youtube watch pages", () => {
    const root = document.createElement("section");
    renderYouTubeCaptionControls(root, { isYouTubeWatch: false, tracks: [], status: "" }, {} as never);

    expect(root.textContent).toContain("YouTube 영상 페이지에서 사용할 수 있습니다.");
    expect(root.querySelector<HTMLButtonElement>("[data-action='start-youtube-caption']")?.disabled).toBe(true);
  });

  test("renders track selector and start/stop actions on youtube watch pages", () => {
    const root = document.createElement("section");
    const tracks: YouTubeCaptionTrack[] = [
      { id: "en", name: "English", languageCode: "en", baseUrl: "https://example.com/en" },
      { id: "ko", name: "Korean", languageCode: "ko", baseUrl: "https://example.com/ko" }
    ];
    const onStart = vi.fn();
    const onStop = vi.fn();

    renderYouTubeCaptionControls(root, { isYouTubeWatch: true, tracks, selectedTrackId: "en", status: "" }, { onStart, onStop });

    expect(root.querySelector<HTMLSelectElement>("[data-role='youtube-caption-track']")?.value).toBe("en");
    root.querySelector<HTMLButtonElement>("[data-action='start-youtube-caption']")?.click();
    root.querySelector<HTMLButtonElement>("[data-action='stop-youtube-caption']")?.click();

    expect(onStart).toHaveBeenCalledWith("en");
    expect(onStop).toHaveBeenCalledOnce();
  });
});
