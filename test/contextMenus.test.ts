import { describe, expect, test, vi } from "vitest";
import { SELECTION_TRANSLATE_MENU_ID, createSelectionContextMenu, handleSelectionContextMenuClick } from "../src/background/contextMenus";

describe("selection context menu", () => {
  test("creates a browser context menu item for selected text", () => {
    const create = vi.fn();
    const removeAll = vi.fn((callback: () => void) => callback());

    createSelectionContextMenu({ create, removeAll });

    expect(removeAll).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      id: SELECTION_TRANSLATE_MENU_ID,
      title: "선택한 텍스트 AI로 번역",
      contexts: ["selection"]
    });
  });

  test("sends selected text to the active tab when the menu item is clicked", async () => {
    const sendMessage = vi.fn();

    await handleSelectionContextMenuClick(
      { menuItemId: SELECTION_TRANSLATE_MENU_ID, selectionText: "Hello" },
      { id: 42 },
      sendMessage
    );

    expect(sendMessage).toHaveBeenCalledWith(42, {
      type: "translateSelectedTextFromContextMenu",
      text: "Hello"
    });
  });

  test("ignores clicks without selected text or tab id", async () => {
    const sendMessage = vi.fn();

    await handleSelectionContextMenuClick(
      { menuItemId: SELECTION_TRANSLATE_MENU_ID },
      { id: 42 },
      sendMessage
    );
    await handleSelectionContextMenuClick(
      { menuItemId: SELECTION_TRANSLATE_MENU_ID, selectionText: "Hello" },
      {},
      sendMessage
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
