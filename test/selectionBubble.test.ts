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

  test("generates and saves a dictionary entry from translated text", async () => {
    const onDictionaryRequest = vi.fn(async () => "test: 시험하거나 확인하기 위한 말.");
    const onDictionarySave = vi.fn(async () => undefined);

    showSelectionBubble({
      anchor: new DOMRect(20, 30, 100, 20),
      state: "translated",
      text: "번역 결과",
      sourceText: "This is a test.",
      onDictionaryRequest,
      onDictionarySave
    });

    const dictionaryButton = document.querySelector<HTMLButtonElement>("[data-action='dictionary']");
    expect(dictionaryButton).not.toBeNull();
    dictionaryButton!.click();

    const input = document.querySelector<HTMLInputElement>("[data-role='dictionary-term']");
    expect(input).not.toBeNull();
    input!.value = "test";
    input!.dispatchEvent(new Event("input"));

    document.querySelector<HTMLButtonElement>("[data-action='generate-dictionary']")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onDictionaryRequest).toHaveBeenCalledWith("test", "This is a test.");
    expect(document.body.textContent).toContain("test: 시험하거나 확인하기 위한 말.");

    document.querySelector<HTMLButtonElement>("[data-action='save-dictionary']")!.click();
    await Promise.resolve();

    expect(onDictionarySave).toHaveBeenCalledWith("test", "This is a test.", "test: 시험하거나 확인하기 위한 말.");
  });

  test("does not render for empty translated text", () => {
    showSelectionBubble({
      anchor: new DOMRect(0, 0, 0, 0),
      state: "translated",
      text: ""
    });

    expect(document.querySelector("[data-ai-translator-bubble]")).toBeNull();
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
