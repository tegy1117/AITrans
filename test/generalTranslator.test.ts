import { describe, expect, test, vi } from "vitest";
import { mountGeneralTranslator } from "../src/generalTranslatorDom";
import type { TranslationHistoryEntry } from "../src/shared/types";

describe("general translator UI", () => {
  test("translates input, copies result, and renders history", async () => {
    const root = document.createElement("div");
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const historyEntry = history("history-1", "Hello", "안녕하세요");
    const onTranslate = vi.fn(async () => ({ translatedText: "안녕하세요", history: [historyEntry] }));

    mountGeneralTranslator(root, {
      draft: { sourceText: "Hello" },
      history: [],
      onTranslate,
      onDeleteHistory: vi.fn(),
      onClearHistory: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("[data-action='general-translate']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onTranslate).toHaveBeenCalledWith("Hello");
    expect(root.querySelector("[data-role='general-result']")?.textContent).toContain("안녕하세요");
    expect(root.textContent).toContain("Hello");

    root.querySelector<HTMLButtonElement>("[data-action='general-copy']")?.click();
    expect(writeText).toHaveBeenCalledWith("안녕하세요");
  });

  test("deletes and clears translation history", async () => {
    const root = document.createElement("div");
    const onDeleteHistory = vi.fn(async () => []);
    const onClearHistory = vi.fn(async () => []);

    mountGeneralTranslator(root, {
      draft: {},
      history: [history("history-1", "Hello", "안녕하세요")],
      onTranslate: vi.fn(),
      onDeleteHistory,
      onClearHistory
    });

    root.querySelector<HTMLButtonElement>("[data-action='clear-general-history']")?.click();
    await Promise.resolve();
    expect(onClearHistory).toHaveBeenCalledOnce();

    mountGeneralTranslator(root, {
      draft: {},
      history: [history("history-1", "Hello", "안녕하세요")],
      onTranslate: vi.fn(),
      onDeleteHistory,
      onClearHistory
    });

    root.querySelector<HTMLButtonElement>("[data-action='delete-general-history']")?.click();
    await Promise.resolve();
    expect(onDeleteHistory).toHaveBeenCalledWith("history-1");
  });

  test("shows provider errors without adding history", async () => {
    const root = document.createElement("div");

    mountGeneralTranslator(root, {
      draft: { sourceText: "Hello" },
      history: [],
      onTranslate: vi.fn(async () => {
        throw new Error("API key is invalid.");
      }),
      onDeleteHistory: vi.fn(),
      onClearHistory: vi.fn()
    });

    root.querySelector<HTMLButtonElement>("[data-action='general-translate']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.textContent).toContain("API key is invalid.");
    expect(root.querySelector("[data-role='general-history']")?.textContent).toContain("아직 번역 기록이 없습니다.");
  });
});

function history(id: string, sourceText: string, translatedText: string): TranslationHistoryEntry {
  return {
    id,
    sourceText,
    translatedText,
    createdAt: "2026-05-25T00:00:00.000Z",
    profileId: "general-default",
    providerId: "ollama-local",
    model: "llama3.2"
  };
}
