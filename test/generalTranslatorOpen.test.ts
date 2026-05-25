import { describe, expect, test, vi } from "vitest";
import { openGeneralTranslatorSurface } from "../src/background/generalTranslatorOpen";

describe("general translator opener", () => {
  test("falls back to a popup window when drawer tab messaging has no receiver", async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });
    const createWindow = vi.fn(async () => ({}));

    await openGeneralTranslatorSurface({
      displayMode: "drawer",
      sourceText: "Hello",
      translatedText: "안녕하세요",
      tabId: 42,
      sendMessage,
      createWindow,
      getExtensionUrl: (path) => `chrome-extension://id/${path}`
    });

    expect(sendMessage).toHaveBeenCalledWith(42, {
      type: "openGeneralTranslatorDrawer",
      sourceText: "Hello",
      translatedText: "안녕하세요"
    });
    expect(createWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("translator.html?sourceText=Hello")
      })
    );
  });

  test("opens a popup window without sending a tab message when no tab is available", async () => {
    const sendMessage = vi.fn();
    const createWindow = vi.fn(async () => ({}));

    await openGeneralTranslatorSurface({
      displayMode: "drawer",
      sourceText: "Hello",
      translatedText: "",
      sendMessage,
      createWindow,
      getExtensionUrl: (path) => `chrome-extension://id/${path}`
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(createWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("translator.html?sourceText=Hello")
      })
    );
  });
});
