import { describe, expect, test, vi } from "vitest";
import { showTranslatorDrawer } from "../src/content/translatorDrawer";

describe("translator drawer", () => {
  test("renders translated text with copy and close actions", () => {
    const writeText = vi.fn();
    const onOpenGeneralTranslator = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });

    showTranslatorDrawer({
      state: "translated",
      text: "번역 결과",
      sourceText: "Original text",
      onOpenGeneralTranslator
    });

    const drawer = document.querySelector("[data-ai-translator-drawer]");
    expect(drawer?.textContent).toContain("원문");
    expect(drawer?.textContent).toContain("Original text");
    expect(drawer?.textContent).toContain("번역문");
    expect(drawer?.textContent).toContain("번역 결과");

    drawer?.querySelector<HTMLButtonElement>("[data-action='copy']")?.click();
    expect(writeText).toHaveBeenCalledWith("번역 결과");

    drawer?.querySelector<HTMLButtonElement>("[data-action='open-general-translator']")?.click();
    expect(onOpenGeneralTranslator).toHaveBeenCalledWith("Original text", "번역 결과");

    drawer?.querySelector<HTMLButtonElement>("[data-action='close']")?.click();
    expect(document.querySelector("[data-ai-translator-drawer]")).toBeNull();
  });

  test("adds highlighted terms from drawer text selection without duplicates", () => {
    showTranslatorDrawer({
      state: "translated",
      text: "first term and second term",
      sourceText: "Original text"
    });

    const result = document.querySelector<HTMLElement>("[data-role='drawer-result']")!;
    selectText(result.firstChild!, 0, 10);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    selectText(result.firstChild!, 0, 10);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    selectText(result.firstChild!, 15, 26);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const terms = Array.from(document.querySelectorAll("[data-role='highlighted-term-label']")).map((node) => node.textContent);
    expect(terms).toEqual(["first term", "second term"]);
  });

  test("generates and saves dictionary candidates independently", async () => {
    const onDictionaryRequest = vi.fn(async (term: string) => `${term}: 설명`);
    const onDictionarySave = vi.fn(async () => undefined);

    showTranslatorDrawer({
      state: "translated",
      text: "alpha beta",
      sourceText: "Original context",
      onDictionaryRequest,
      onDictionarySave
    });

    const result = document.querySelector<HTMLElement>("[data-role='drawer-result']")!;
    selectText(result.firstChild!, 0, 5);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    selectText(result.firstChild!, 6, 10);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    document.querySelector<HTMLButtonElement>("[data-action='generate-dictionaries']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    const savedContext = "원문:\nOriginal context\n\n번역문:\nalpha beta";
    expect(onDictionaryRequest).toHaveBeenCalledWith("alpha", "Original context", "alpha beta", "translation");
    expect(onDictionaryRequest).toHaveBeenCalledWith("beta", "Original context", "alpha beta", "translation");
    expect(document.body.textContent).toContain("alpha: 설명");
    expect(document.body.textContent).toContain("beta: 설명");

    document.querySelector<HTMLButtonElement>("[data-action='save-dictionary-candidate']")?.click();
    await Promise.resolve();

    expect(onDictionarySave).toHaveBeenCalledWith("alpha", savedContext, "alpha: 설명");
  });

  test("adds highlighted terms from source and translated text selections", () => {
    showTranslatorDrawer({
      state: "translated",
      text: "translated term",
      sourceText: "source term"
    });

    const source = document.querySelector<HTMLElement>("[data-role='drawer-source']")!;
    selectText(source.firstChild!, 0, 6);
    source.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const result = document.querySelector<HTMLElement>("[data-role='drawer-result']")!;
    selectText(result.firstChild!, 0, 10);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const terms = Array.from(document.querySelectorAll("[data-role='highlighted-term-label']")).map((node) => node.textContent);
    expect(terms).toEqual(["source", "translated"]);
  });

  test("uses original text as content and translated text as dictionary translation context", async () => {
    const onDictionaryRequest = vi.fn(async (term: string) => `${term}: 설명`);

    showTranslatorDrawer({
      state: "translated",
      text: "번역된 전체 문장",
      sourceText: "Original full sentence",
      onDictionaryRequest
    });

    const source = document.querySelector<HTMLElement>("[data-role='drawer-source']")!;
    selectText(source.firstChild!, 0, 8);
    source.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    document.querySelector<HTMLButtonElement>("[data-action='generate-dictionaries']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onDictionaryRequest).toHaveBeenCalledWith("Original", "Original full sentence", "번역된 전체 문장", "source");
  });

  test("keeps equal source and translated terms separate for dictionary generation", async () => {
    const onDictionaryRequest = vi.fn(async (term: string, _sourceText: string, _translationContext: string, termSource: string) =>
      `${term}-${termSource}`
    );

    showTranslatorDrawer({
      state: "translated",
      text: "same",
      sourceText: "same",
      onDictionaryRequest
    });

    const source = document.querySelector<HTMLElement>("[data-role='drawer-source']")!;
    selectText(source.firstChild!, 0, 4);
    source.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const result = document.querySelector<HTMLElement>("[data-role='drawer-result']")!;
    selectText(result.firstChild!, 0, 4);
    result.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    document.querySelector<HTMLButtonElement>("[data-action='generate-dictionaries']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onDictionaryRequest).toHaveBeenCalledWith("same", "same", "same", "source");
    expect(onDictionaryRequest).toHaveBeenCalledWith("same", "same", "same", "translation");
  });

  test("renders loading and error states", () => {
    showTranslatorDrawer({ state: "loading", text: "" });
    expect(document.body.textContent).toContain("번역 중...");

    showTranslatorDrawer({ state: "error", text: "실패했습니다." });
    expect(document.body.textContent).toContain("실패했습니다.");
  });
});

function selectText(node: Node, start: number, end: number): void {
  const selection = window.getSelection()!;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  selection.removeAllRanges();
  selection.addRange(range);
}
