import { describe, expect, test } from "vitest";
import { createDefaultState, normalizeState } from "../src/shared/storage";

describe("storage state", () => {
  test("creates default prompt profiles for all planned purposes", () => {
    const state = createDefaultState();

    expect(state.promptProfiles.map((profile) => profile.purpose).sort()).toEqual([
      "dictionary",
      "dictionary-source",
      "image",
      "page",
      "selection"
    ]);
    expect(state.selectionResultDisplayMode).toBe("drawer");
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
        "dictionary-source": "dictionary-source-default"
      }
    });

    expect(state.activeProfileByPurpose.page).toBe("page-default");
  });
});
