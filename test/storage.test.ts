import { describe, expect, test } from "vitest";
import { createDefaultState, normalizeState } from "../src/shared/storage";

describe("storage state", () => {
  test("creates default prompt profiles for all planned purposes", () => {
    const state = createDefaultState();

    expect(state.promptProfiles.map((profile) => profile.purpose).sort()).toEqual([
      "dictionary",
      "dictionary-source",
      "general",
      "image",
      "page",
      "selection"
    ]);
    expect(state.selectionResultDisplayMode).toBe("drawer");
    expect(state.generalTranslatorDisplayMode).toBe("drawer");
    expect(state.translationHistory).toEqual([]);
  });

  test("creates separate active profiles for source and translated dictionary terms", () => {
    const state = createDefaultState();

    expect(state.activeProfileByPurpose["dictionary-source"]).toBe("dictionary-source-default");
    expect(state.activeProfileByPurpose.dictionary).toBe("dictionary-default");
  });

  test("adds missing source dictionary profile when normalizing older state", () => {
    const oldState = createDefaultState();
    const normalized = normalizeState({
      promptProfiles: oldState.promptProfiles.filter((profile) => profile.purpose !== "dictionary-source")
    });

    expect(normalized.promptProfiles.some((profile) => profile.id === "dictionary-source-default")).toBe(true);
    expect(normalized.activeProfileByPurpose["dictionary-source"]).toBe("dictionary-source-default");
  });

  test("adds missing general translator state when normalizing older state", () => {
    const oldState = createDefaultState();
    const normalized = normalizeState({
      promptProfiles: oldState.promptProfiles.filter((profile) => profile.purpose !== "general")
    });

    expect(normalized.promptProfiles.some((profile) => profile.id === "general-default")).toBe(true);
    expect(normalized.activeProfileByPurpose.general).toBe("general-default");
    expect(normalized.generalTranslatorDisplayMode).toBe("drawer");
    expect(normalized.translationHistory).toEqual([]);
  });

  test("keeps only the latest 100 translation history entries", () => {
    const entries = Array.from({ length: 105 }, (_, index) => ({
      id: `history-${index}`,
      sourceText: `source-${index}`,
      translatedText: `translated-${index}`,
      createdAt: `2026-05-25T00:00:${String(index).padStart(2, "0")}.000Z`,
      profileId: "general-default",
      providerId: "ollama-local",
      model: "llama3.2"
    }));

    const state = normalizeState({ translationHistory: entries });

    expect(state.translationHistory).toHaveLength(100);
    expect(state.translationHistory[0]?.id).toBe("history-0");
    expect(state.translationHistory.at(-1)?.id).toBe("history-99");
  });

  test("normalizes missing persisted fields without losing provider configs", () => {
    const state = normalizeState({
      providerConfigs: [{ id: "ollama", type: "ollama-local", name: "Local", baseUrl: "http://localhost:11434" }]
    });

    expect(state.providerConfigs).toHaveLength(1);
    expect(state.dictionaryEntries).toEqual([]);
    expect(state.activeProfileByPurpose.page).toBeTruthy();
    expect(state.selectionResultDisplayMode).toBe("drawer");
  });

  test("preserves persisted selection result display mode", () => {
    const state = normalizeState({ selectionResultDisplayMode: "bubble" });

    expect(state.selectionResultDisplayMode).toBe("bubble");
  });

  test("repairs active profile ids that no longer exist", () => {
    const state = normalizeState({
      activeProfileByPurpose: {
        page: "missing",
        selection: "selection-default",
        image: "image-default",
        dictionary: "dictionary-default",
        "dictionary-source": "dictionary-source-default",
        general: "general-default"
      }
    });

    expect(state.activeProfileByPurpose.page).toBe("page-default");
  });
});
