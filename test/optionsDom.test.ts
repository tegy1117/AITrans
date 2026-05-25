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

  test("keeps the active prompt textarea while editing and only persists on save", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const state = createDefaultState();

    const app = mountOptionsApp(root, state, { onSave });
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea).toBeDefined();

    textarea!.value = "수정한 프롬프트 {{content}}";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector("textarea")).toBe(textarea);
    expect(onSave).not.toHaveBeenCalled();
    expect(app.getState().promptProfiles.find((profile) => profile.id === "page-default")?.messages[0]?.content).toBe(
      "수정한 프롬프트 {{content}}"
    );

    Array.from(root.querySelectorAll("button"))
      .find((button) => button.textContent === "전체 설정 저장")
      ?.click();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].promptProfiles.find((profile) => profile.id === "page-default")?.messages[0]?.content).toBe(
      "수정한 프롬프트 {{content}}"
    );
  });

  test("blocks internal profile navigation while prompt changes are unsaved", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    mountOptionsApp(root, createDefaultState(), { onSave });
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea");
    textarea!.value = "수정한 프롬프트 {{content}}";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    const selectionPurposeButton = Array.from(root.querySelectorAll("button")).find((button) => button.textContent === "선택 영역 번역");
    selectionPurposeButton?.click();

    expect(alertSpy).toHaveBeenCalledWith("저장하지 않은 변경사항이 있습니다. 저장하거나 변경 취소 후 이동하세요.");
    expect(selectionPurposeButton?.classList.contains("selected")).toBe(false);

    alertSpy.mockRestore();
  });

  test("cancels unsaved prompt changes and allows navigation afterward", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);

    mountOptionsApp(root, createDefaultState(), { onSave });
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea");
    const originalValue = textarea!.value;
    textarea!.value = "수정한 프롬프트 {{content}}";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    Array.from(root.querySelectorAll("button"))
      .find((button) => button.textContent === "변경 취소")
      ?.click();

    expect(root.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(originalValue);

    const selectionPurposeButton = Array.from(root.querySelectorAll("button")).find((button) => button.textContent === "선택 영역 번역");
    selectionPurposeButton?.click();

    const selectedSelectionPurposeButton = Array.from(root.querySelectorAll("button")).find((button) => button.textContent === "선택 영역 번역");
    expect(selectedSelectionPurposeButton?.classList.contains("selected")).toBe(true);
  });

  test("prevents browser navigation while prompt changes are unsaved", () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);

    mountOptionsApp(root, createDefaultState(), { onSave });
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea");
    textarea!.value = "수정한 프롬프트 {{content}}";
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));

    const event = new Event("beforeunload", { cancelable: true });
    const prevented = !window.dispatchEvent(event);

    expect(prevented).toBe(true);
  });

  test("does not render saved dictionary entries inside the settings editor", async () => {
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

    expect(root.textContent).not.toContain("저장된 사전");
    expect(root.textContent).not.toContain("test");
    expect(root.textContent).not.toContain("테스트 설명");
    expect(root.querySelector<HTMLButtonElement>("[data-action='delete-dictionary-entry']")).toBeNull();
  });

  test("saves selection result display mode immediately when changed", async () => {
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
    await Promise.resolve();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].selectionResultDisplayMode).toBe("bubble");
  });

  test("saves general translator display mode immediately when changed", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const state = createDefaultState();

    mountOptionsApp(root, state, { onSave });

    const displayModeSelect = Array.from(root.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("일반 번역창 표시 방식")
    )?.querySelector("select");
    expect(displayModeSelect).toBeDefined();

    displayModeSelect!.value = "tab";
    displayModeSelect!.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].generalTranslatorDisplayMode).toBe("tab");
  });

  test("saves youtube caption position immediately when changed", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onSave = vi.fn<(state: ExtensionState) => Promise<void>>(async () => undefined);
    const state = createDefaultState();

    mountOptionsApp(root, state, { onSave });

    const select = Array.from(root.querySelectorAll("label")).find((label) =>
      label.textContent?.includes("유튜브 자막 번역 표시 위치")
    )?.querySelector("select");
    expect(select).toBeDefined();

    select!.value = "above";
    select!.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0].youtubeCaptionPosition).toBe("above");
  });
});
