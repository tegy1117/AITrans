import { describe, expect, test, vi } from "vitest";
import {
  IMAGE_TRANSLATE_MENU_ID,
  SELECTION_TRANSLATE_MENU_ID,
  createTranslationContextMenus,
  handleTranslationContextMenuClick
} from "../src/background/contextMenus";

describe("translation context menus", () => {
  test("creates browser context menu items for selected text and images", () => {
    const create = vi.fn();
    const removeAll = vi.fn((callback: () => void) => callback());

    createTranslationContextMenus({ create, removeAll });

    expect(removeAll).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      id: SELECTION_TRANSLATE_MENU_ID,
      title: "선택한 텍스트 AI로 번역",
      contexts: ["selection"]
    });
    expect(create).toHaveBeenCalledWith({
      id: IMAGE_TRANSLATE_MENU_ID,
      title: "이미지 AI로 번역",
      contexts: ["image"]
    });
  });

  test("sends selected text to the active tab when the menu item is clicked", async () => {
    const sendMessage = vi.fn();

    await handleTranslationContextMenuClick(
      { menuItemId: SELECTION_TRANSLATE_MENU_ID, selectionText: "Hello" },
      { id: 42 },
      sendMessage
    );

    expect(sendMessage).toHaveBeenCalledWith(42, {
      type: "translateSelectedTextFromContextMenu",
      text: "Hello"
    });
  });

  test("sends image source URL to the active tab when an image menu item is clicked", async () => {
    const sendMessage = vi.fn();

    await handleTranslationContextMenuClick(
      { menuItemId: IMAGE_TRANSLATE_MENU_ID, srcUrl: "https://example.com/image.png" },
      { id: 42 },
      sendMessage
    );

    expect(sendMessage).toHaveBeenCalledWith(42, {
      type: "translateImageFromContextMenu",
      imageUrl: "https://example.com/image.png"
    });
  });

  test("ignores clicks without selected text or tab id", async () => {
    const sendMessage = vi.fn();

    await handleTranslationContextMenuClick(
      { menuItemId: SELECTION_TRANSLATE_MENU_ID },
      { id: 42 },
      sendMessage
    );
    await handleTranslationContextMenuClick(
      { menuItemId: SELECTION_TRANSLATE_MENU_ID, selectionText: "Hello" },
      {},
      sendMessage
    );
    await handleTranslationContextMenuClick(
      { menuItemId: IMAGE_TRANSLATE_MENU_ID },
      { id: 42 },
      sendMessage
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("does not leak a rejected tab message when the content script is unavailable", async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });

    await expect(
      handleTranslationContextMenuClick(
        { menuItemId: SELECTION_TRANSLATE_MENU_ID, selectionText: "Hello" },
        { id: 42 },
        sendMessage
      )
    ).resolves.toBeUndefined();
  });

  test("exposes a safe fire-and-forget context menu click handler", async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });

    const { createContextMenuClickHandler } = await import("../src/background/contextMenus");
    const handler = createContextMenuClickHandler(sendMessage);

    expect(() =>
      handler({ menuItemId: SELECTION_TRANSLATE_MENU_ID, selectionText: "Hello" }, { id: 42 })
    ).not.toThrow();
    await Promise.resolve();
  });
});
