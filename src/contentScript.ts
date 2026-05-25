import type { BackgroundResponse } from "./shared/types";
import { collectTranslatableTextNodes, createBatches, replaceTextNodes, restoreTextNodes, type TextReplacement } from "./content/domTranslator";
import { showTranslatorDrawer } from "./content/translatorDrawer";
import { rememberSelectionAnchor } from "./content/selectionContext";

let replacements: TextReplacement[] = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "translateCurrentPage") {
    translateCurrentPage()
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "restoreCurrentPage") {
    restoreTextNodes(replacements);
    replacements = [];
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "translateSelectedTextFromContextMenu") {
    translateSelectionText(String(message.text ?? ""))
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "translateImageFromContextMenu") {
    translateImageUrl(String(message.imageUrl ?? ""))
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  return false;
});

document.addEventListener("selectionchange", () => rememberSelectionAnchor());
document.addEventListener("contextmenu", () => {
  rememberSelectionAnchor();
});

async function translateCurrentPage(): Promise<void> {
  restoreTextNodes(replacements);
  replacements = [];

  const nodes = collectTranslatableTextNodes(document.body);
  const texts = nodes.map((node) => node.textContent ?? "");
  const translated: string[] = [];

  for (const batch of createBatches(texts)) {
    const response = await sendBackground({ type: "translatePage", texts: batch });
    if (!response.ok || !response.texts) throw new Error(response.ok ? "No translated page text returned." : response.error);
    translated.push(...response.texts);
  }

  replacements = replaceTextNodes(nodes, translated);
}

async function translateSelectionText(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  showTranslatorDrawer({ state: "loading", text: "" });

  const response = await sendBackground({ type: "translateSelection", text: trimmed });
  if (!response.ok || !response.text) {
    showTranslatorDrawer({ state: "error", text: response.ok ? "선택 번역 결과가 반환되지 않았습니다." : response.error });
    return;
  }

  showTranslatorDrawer({
    state: "translated",
    text: response.text,
    sourceText: trimmed,
    ...dictionaryCallbacks()
  });
}

async function translateImageUrl(imageUrl: string): Promise<void> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return;

  showTranslatorDrawer({ state: "loading", text: "" });

  const response = await sendBackground({ type: "translateImage", imageUrl: trimmed });
  if (!response.ok || !response.text) {
    showTranslatorDrawer({ state: "error", text: response.ok ? "이미지 번역 결과가 반환되지 않았습니다." : response.error });
    return;
  }

  showTranslatorDrawer({
    state: "translated",
    text: response.text,
    sourceText: response.text,
    ...dictionaryCallbacks()
  });
}

function sendBackground(message: unknown): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(message);
}

function dictionaryCallbacks() {
  return {
    onDictionaryRequest: async (term: string, sourceText: string) => {
      const dictionaryResponse = await sendBackground({ type: "generateDictionaryEntry", term, sourceText });
      if (!dictionaryResponse.ok || !dictionaryResponse.text) {
        throw new Error(dictionaryResponse.ok ? "사전 설명이 반환되지 않았습니다." : dictionaryResponse.error);
      }
      return dictionaryResponse.text;
    },
    onDictionarySave: async (term: string, sourceText: string, explanation: string) => {
      const entry = {
        id: crypto.randomUUID(),
        term,
        sourceText,
        explanation,
        createdAt: new Date().toISOString()
      };
      const saveResponse = await sendBackground({ type: "saveDictionaryEntry", entry });
      if (!saveResponse.ok) throw new Error(saveResponse.error);
    }
  };
}
