import { describe, expect, test, vi } from "vitest";
import { mountGeneralTranslator } from "../src/generalTranslatorDom";
import type { TranslationHistoryEntry } from "../src/shared/types";

describe("general translator UI", () => {
  test("translates input, copies result, and renders history", async () => {
    const root = document.createElement("div");
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const historyEntry = history("history-1", "Hello", "안녕하세요", "문학 번역");
    const onTranslate = vi.fn(async () => ({ translatedText: "안녕하세요", history: [historyEntry] }));

    mountGeneralTranslator(root, {
      draft: { sourceText: "Hello" },
      history: [],
      profileOptions: [
        { id: "general-default", name: "일반 번역", model: "llama3.2" },
        { id: "general-literary", name: "문학 번역", model: "gpt-4.1" }
      ],
      activeProfileId: "general-literary",
      onTranslate,
      onDeleteHistory: vi.fn(),
      onClearHistory: vi.fn()
    });

    expect(root.querySelector("[data-role='general-translator']")?.classList.contains("translator-shell")).toBe(true);
    expect(root.querySelector("[data-role='general-board']")).toBeDefined();
    expect(root.querySelectorAll(".translator-panel")).toHaveLength(2);

    root.querySelector<HTMLButtonElement>("[data-action='general-translate']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onTranslate).toHaveBeenCalledWith("Hello", "general-literary");
    expect(root.querySelector("[data-role='general-result']")?.textContent).toContain("안녕하세요");
    expect(root.textContent).toContain("Hello");
    expect(root.textContent).toContain("문학 번역");

    root.querySelector<HTMLButtonElement>("[data-action='general-copy']")?.click();
    expect(writeText).toHaveBeenCalledWith("안녕하세요");
  });

  test("deletes and clears translation history", async () => {
    const root = document.createElement("div");
    const onDeleteHistory = vi.fn(async () => []);
    const onClearHistory = vi.fn(async () => []);

    mountGeneralTranslator(root, {
      draft: {},
      history: [history("history-1", "Hello", "안녕하세요", "일반 번역")],
      profileOptions: [{ id: "general-default", name: "일반 번역", model: "llama3.2" }],
      activeProfileId: "general-default",
      onTranslate: vi.fn(),
      onDeleteHistory,
      onClearHistory
    });

    root.querySelector<HTMLButtonElement>("[data-action='clear-general-history']")?.click();
    await Promise.resolve();
    expect(onClearHistory).toHaveBeenCalledOnce();

    mountGeneralTranslator(root, {
      draft: {},
      history: [history("history-1", "Hello", "안녕하세요", "일반 번역")],
      profileOptions: [{ id: "general-default", name: "일반 번역", model: "llama3.2" }],
      activeProfileId: "general-default",
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
      profileOptions: [{ id: "general-default", name: "일반 번역", model: "llama3.2" }],
      activeProfileId: "general-default",
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

  test("lets the user choose a general translation profile", async () => {
    const root = document.createElement("div");
    const onTranslate = vi.fn(async () => ({ translatedText: "결과", history: [] }));

    mountGeneralTranslator(root, {
      draft: { sourceText: "Hello" },
      history: [],
      profileOptions: [
        { id: "general-default", name: "일반 번역", model: "llama3.2" },
        { id: "general-formal", name: "격식 번역", model: "gpt-4.1-mini" }
      ],
      activeProfileId: "general-default",
      onTranslate,
      onDeleteHistory: vi.fn(),
      onClearHistory: vi.fn()
    });

    const select = root.querySelector<HTMLSelectElement>("[data-role='general-profile']");
    expect(select).toBeDefined();
    select!.value = "general-formal";
    select!.dispatchEvent(new Event("change"));

    root.querySelector<HTMLButtonElement>("[data-action='general-translate']")?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onTranslate).toHaveBeenCalledWith("Hello", "general-formal");
  });
});

function history(id: string, sourceText: string, translatedText: string, profileName: string): TranslationHistoryEntry {
  return {
    id,
    sourceText,
    translatedText,
    createdAt: "2026-05-25T00:00:00.000Z",
    profileId: "general-default",
    profileName,
    providerId: "ollama-local",
    model: "llama3.2"
  };
}
