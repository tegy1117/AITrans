import { describe, expect, test, vi } from "vitest";
import { showSelectionBubble } from "../src/content/selectionBubble";

describe("selection bubble", () => {
  test("renders translated text with copy and close actions", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });

    showSelectionBubble({
      anchor: new DOMRect(20, 30, 100, 20),
      state: "translated",
      text: "번역 결과"
    });

    const bubble = document.querySelector("[data-ai-translator-bubble]");
    expect(bubble?.textContent).toContain("번역 결과");

    (bubble?.querySelector("[data-action='copy']") as HTMLButtonElement).click();
    expect(writeText).toHaveBeenCalledWith("번역 결과");

    (bubble?.querySelector("[data-action='close']") as HTMLButtonElement).click();
    expect(document.querySelector("[data-ai-translator-bubble]")).toBeNull();
  });

  test("does not render for empty translated text", () => {
    showSelectionBubble({
      anchor: new DOMRect(0, 0, 0, 0),
      state: "translated",
      text: ""
    });

    expect(document.querySelector("[data-ai-translator-bubble]")).toBeNull();
  });

  test("renders dictionary drawer button without input controls inside the small bubble", () => {
    const onOpenDictionaryDrawer = vi.fn();

    showSelectionBubble({
      anchor: new DOMRect(20, 30, 100, 20),
      state: "translated",
      text: "번역 결과",
      sourceText: "Original",
      onOpenDictionaryDrawer
    });

    expect(document.querySelector("[data-role='dictionary-term']")).toBeNull();

    document.querySelector<HTMLButtonElement>("[data-action='dictionary']")?.click();
    expect(onOpenDictionaryDrawer).toHaveBeenCalledOnce();
  });

  test("renders image translation loading and error states", () => {
    showSelectionBubble({
      anchor: new DOMRect(10, 10, 0, 0),
      state: "loading",
      text: ""
    });
    expect(document.body.textContent).toContain("번역 중...");

    showSelectionBubble({
      anchor: new DOMRect(10, 10, 0, 0),
      state: "error",
      text: "이미지 번역에 실패했습니다."
    });
    expect(document.body.textContent).toContain("이미지 번역에 실패했습니다.");
  });
});
