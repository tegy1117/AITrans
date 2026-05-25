import { describe, expect, test, vi } from "vitest";
import { createChromeTabContentScriptApi, sendTabRequestToContentScript } from "../src/background/tabMessaging";
import type { BackgroundResponse } from "../src/shared/types";

const missingReceiver = new Error("Could not establish connection. Receiving end does not exist.");

describe("background tab messaging", () => {
  test("injects the content script and waits for readiness before retrying the original request", async () => {
    let requestAttempts = 0;
    let readyAttempts = 0;
    const sendMessage = vi.fn(async (_tabId: number, message: unknown): Promise<BackgroundResponse> => {
      if (isMessageType(message, "aiTranslatorContentReady")) {
        readyAttempts += 1;
        if (readyAttempts < 2) throw missingReceiver;
        return { ok: true };
      }

      requestAttempts += 1;
      if (requestAttempts === 1) throw missingReceiver;
      return { ok: true, tracks: [] };
    });
    const injectContentScript = vi.fn(async () => undefined);

    const response = await sendTabRequestToContentScript(
      42,
      { type: "getYouTubeCaptionTracks" },
      { sendMessage, injectContentScript, delay: async () => undefined }
    );

    expect(response).toEqual({ ok: true, tracks: [] });
    expect(injectContentScript).toHaveBeenCalledWith(42);
    expect(sendMessage).toHaveBeenCalledWith(42, { type: "aiTranslatorContentReady" });
  });

  test("injects the content script into the isolated extension world", async () => {
    const executeScript = vi.fn(async () => []);
    vi.stubGlobal("chrome", {
      tabs: {
        sendMessage: vi.fn()
      },
      runtime: {},
      scripting: {
        executeScript
      }
    });

    try {
      const api = createChromeTabContentScriptApi();
      await api.injectContentScript(42);

      expect(executeScript).toHaveBeenCalledWith({
        target: { tabId: 42 },
        files: ["contentScript.js"],
        world: "ISOLATED"
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function isMessageType(message: unknown, type: string): boolean {
  return Boolean(message && typeof message === "object" && "type" in message && message.type === type);
}
