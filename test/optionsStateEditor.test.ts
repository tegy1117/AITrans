import { describe, expect, test } from "vitest";
import {
  addProfile,
  addProvider,
  deleteProfile,
  deleteProvider,
  duplicateProfile,
  setActiveProfile,
  updateProfile,
  updateProvider
} from "../src/options/stateEditor";
import { createDefaultState } from "../src/shared/storage";

describe("options state editor", () => {
  test("adds and updates providers without dropping existing settings", () => {
    const state = createDefaultState();
    const withProvider = addProvider(state, {
      id: "openai-main",
      name: "OpenAI Main",
      type: "custom-openai-compatible",
      apiKey: "key",
      baseUrl: "https://api.example.com/v1"
    });

    const updated = updateProvider(withProvider, "openai-main", { name: "Updated", apiKey: "new-key" });

    expect(updated.providerConfigs).toHaveLength(2);
    expect(updated.providerConfigs.find((provider) => provider.id === "openai-main")).toMatchObject({
      name: "Updated",
      apiKey: "new-key",
      baseUrl: "https://api.example.com/v1"
    });
  });

  test("uses the Ollama local default base URL for new local providers", () => {
    const state = addProvider(createDefaultState(), {
      id: "local-2",
      name: "Local 2",
      type: "ollama-local"
    });

    expect(state.providerConfigs.find((provider) => provider.id === "local-2")?.baseUrl).toBe("http://localhost:11434");
  });

  test("prevents deleting providers used by prompt profiles", () => {
    const state = createDefaultState();

    expect(() => deleteProvider(state, "ollama-local")).toThrow("프롬프트 프로필");
  });

  test("adds, duplicates, and activates prompt profiles", () => {
    const state = addProvider(createDefaultState(), {
      id: "custom",
      name: "Custom",
      type: "custom-openai-compatible",
      baseUrl: "https://api.example.com/v1"
    });
    const withProfile = addProfile(state, {
      id: "selection-formal",
      purpose: "selection",
      name: "Formal selection",
      providerId: "custom",
      model: "model-a"
    });
    const duplicated = duplicateProfile(withProfile, "selection-formal", "selection-formal-copy");
    const active = setActiveProfile(duplicated, "selection", "selection-formal-copy");

    expect(active.promptProfiles.some((profile) => profile.id === "selection-formal-copy")).toBe(true);
    expect(active.activeProfileByPurpose.selection).toBe("selection-formal-copy");
  });

  test("deleting the active profile switches to another profile with the same purpose", () => {
    const state = setActiveProfile(
      addProfile(createDefaultState(), {
        id: "page-alt",
        purpose: "page",
        name: "Page alt",
        providerId: "ollama-local",
        model: "llama3.2"
      }),
      "page",
      "page-alt"
    );

    const next = deleteProfile(state, "page-alt");

    expect(next.activeProfileByPurpose.page).toBe("page-default");
  });

  test("prevents deleting the last profile for a purpose", () => {
    const state = createDefaultState();

    expect(() => deleteProfile(state, "page-default")).toThrow("마지막 프로필");
  });

  test("preserves message order including assistant prefill messages", () => {
    const state = updateProfile(createDefaultState(), "selection-default", {
      messages: [
        { role: "system", content: "Translate carefully." },
        { role: "assistant", content: "Translation:" },
        { role: "user", content: "{{content}}" }
      ]
    });

    expect(state.promptProfiles.find((profile) => profile.id === "selection-default")?.messages).toEqual([
      { role: "system", content: "Translate carefully." },
      { role: "assistant", content: "Translation:" },
      { role: "user", content: "{{content}}" }
    ]);
  });
});
