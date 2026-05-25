import { describe, expect, test } from "vitest";
import { createDefaultState, normalizeState } from "../src/shared/storage";

describe("storage state", () => {
  test("creates default prompt profiles for all planned purposes", () => {
    const state = createDefaultState();

    expect(state.promptProfiles.map((profile) => profile.purpose).sort()).toEqual([
      "dictionary",
      "image",
      "page",
      "selection"
    ]);
  });

  test("normalizes missing persisted fields without losing provider configs", () => {
    const state = normalizeState({
      providerConfigs: [{ id: "ollama", type: "ollama-local", name: "Local", baseUrl: "http://localhost:11434" }]
    });

    expect(state.providerConfigs).toHaveLength(1);
    expect(state.dictionaryEntries).toEqual([]);
    expect(state.activeProfileByPurpose.page).toBeTruthy();
  });

  test("repairs active profile ids that no longer exist", () => {
    const state = normalizeState({
      activeProfileByPurpose: {
        page: "missing",
        selection: "selection-default",
        image: "image-default",
        dictionary: "dictionary-default"
      }
    });

    expect(state.activeProfileByPurpose.page).toBe("page-default");
  });
});
