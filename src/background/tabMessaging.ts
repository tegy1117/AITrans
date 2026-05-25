import type { BackgroundResponse } from "../shared/types";
import { isMissingReceiverRejection } from "./runtimeErrors";

const CONTENT_READY_MESSAGE = { type: "aiTranslatorContentReady" };
const READY_ATTEMPTS = 8;
const READY_DELAY_MS = 50;

export interface TabContentScriptApi {
  sendMessage(tabId: number, message: unknown): Promise<BackgroundResponse | undefined>;
  injectContentScript(tabId: number): Promise<void>;
  delay(ms: number): Promise<void>;
}

export async function sendTabRequestToContentScript(
  tabId: number,
  message: unknown,
  api: TabContentScriptApi = createChromeTabContentScriptApi()
): Promise<BackgroundResponse> {
  const firstResponse = await sendMessageSafely(api, tabId, message);
  if (firstResponse.ok || !isMissingReceiverRejection(firstResponse.error)) return firstResponse;

  const injection = await injectContentScriptSafely(api, tabId);
  if (!injection.ok) return injection;

  const ready = await waitForContentScriptReady(api, tabId);
  if (!ready.ok) return ready;

  const retriedResponse = await sendMessageSafely(api, tabId, message);
  if (retriedResponse.ok || !isMissingReceiverRejection(retriedResponse.error)) return retriedResponse;

  return {
    ok: false,
    error: "탭 연결이 아직 준비되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."
  };
}

export function createChromeTabContentScriptApi(): TabContentScriptApi {
  return {
    sendMessage(tabId, message) {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response: BackgroundResponse | undefined) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(response);
        });
      });
    },
    async injectContentScript(tabId) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["contentScript.js"] });
    },
    delay(ms) {
      return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
    }
  };
}

async function waitForContentScriptReady(api: TabContentScriptApi, tabId: number): Promise<BackgroundResponse> {
  let lastResponse: BackgroundResponse = {
    ok: false,
    error: "탭 연결이 아직 준비되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."
  };

  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    lastResponse = await sendMessageSafely(api, tabId, CONTENT_READY_MESSAGE);
    if (lastResponse.ok) return lastResponse;
    await api.delay(READY_DELAY_MS);
  }

  return isMissingReceiverRejection(lastResponse.error)
    ? {
        ok: false,
        error: "탭 연결이 아직 준비되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."
      }
    : lastResponse;
}

async function sendMessageSafely(api: TabContentScriptApi, tabId: number, message: unknown): Promise<BackgroundResponse> {
  try {
    return (await api.sendMessage(tabId, message)) ?? { ok: false, error: "탭에서 응답이 반환되지 않았습니다." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function injectContentScriptSafely(api: TabContentScriptApi, tabId: number): Promise<BackgroundResponse> {
  try {
    await api.injectContentScript(tabId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "이 페이지에서는 확장 프로그램 content script를 실행할 수 없습니다."
    };
  }
}
