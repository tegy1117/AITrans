import { describe, expect, test, vi } from "vitest";
import { mountOptionsApp } from "../src/options/dom";
import { createDefaultState } from "../src/shared/storage";
import type { ExtensionState } from "../src/shared/types";

describe("options DOM app", () => {
  test("saves ordered prompt messages including assistant prefill", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const state = createDefaultState();
    state.promptProfiles = state.promptProfiles.map((profile) =>
      profile.id === "selection-default"
        ? {
            ...profile,
            messages: [
              { role: "system", content: "System" },
              { role: "assistant", content: "Prefill:" },
              { role: "user", content: "{{content}}" }
            ]
          }
        : profile
    );

    mountOptionsApp(root, state, { onSave });
    Array.from(root.querySelectorAll("button"))
      .find((button) => button.textContent === "선택 영역 번역")
      ?.click();
    Array.from(root.querySelectorAll("button"))
      .find((button) => button.textContent === "전체 설정 저장")
      ?.click();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    const savedState = onSave.mock.calls[0]?.[0];
    expect(savedState).toBeDefined();
    expect(savedState.promptProfiles.find((profile) => profile.id === "selection-default")?.messages).toEqual([
      { role: "system", content: "System" },
      { role: "assistant", content: "Prefill:" },
      { role: "user", content: "{{content}}" }
    ]);
  });

  test("renders saved dictionary entries and deletes them", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const state = createDefaultState();
    state.dictionaryEntries = [
      {
        id: "dict-1",
        term: "test",
        sourceText: "This is a test.",
        explanation: "테스트 설명",
        createdAt: "2026-05-25T00:00:00.000Z"
      }
    ];

    mountOptionsApp(root, state, { onSave });

    expect(root.textContent).toContain("저장된 사전");
    expect(root.textContent).toContain("test");
    expect(root.textContent).toContain("테스트 설명");

    root.querySelector<HTMLButtonElement>("[data-action='delete-dictionary-entry']")?.click();

    expect(root.textContent).toContain("아직 저장된 사전 항목이 없습니다.");
  });

  test("saves selection result display mode setting", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const state = createDefaultState();

    mountOptionsApp(root, state, { onSave });

    const displayModeSelect = Array.from(root.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("선택 번역 결과 표시 방식")
    )?.querySelector("select");
    expect(displayModeSelect).toBeDefined();

    displayModeSelect!.value = "bubble";
    displayModeSelect!.dispatchEvent(new Event("change"));

    Array.from(root.querySelectorAll("button"))
      .find((button) => button.textContent === "전체 설정 저장")
      ?.click();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].selectionResultDisplayMode).toBe("bubble");
  });
});
