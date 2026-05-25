import type { BackgroundResponse } from "./shared/types";
import { collectTranslatableTextNodes, createBatches, replaceTextNodes, restoreTextNodes, type TextReplacement } from "./content/domTranslator";
import { showSelectionBubble } from "./content/selectionBubble";
import { getSelectionAnchor, rememberSelectionAnchor } from "./content/selectionContext";

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

  return false;
});

document.addEventListener("selectionchange", () => rememberSelectionAnchor());
document.addEventListener("contextmenu", () => rememberSelectionAnchor());

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

  const anchor = getSelectionAnchor();
  showSelectionBubble({ anchor, state: "loading", text: "" });

  const response = await sendBackground({ type: "translateSelection", text: trimmed });
  if (!response.ok || !response.text) {
    showSelectionBubble({ anchor, state: "error", text: response.ok ? "No translated text returned." : response.error });
    return;
  }

  showSelectionBubble({
    anchor,
    state: "translated",
    text: response.text,
    sourceText: trimmed,
    onDictionaryRequest: async (term, sourceText) => {
      const dictionaryResponse = await sendBackground({ type: "generateDictionaryEntry", term, sourceText });
      if (!dictionaryResponse.ok || !dictionaryResponse.text) {
        throw new Error(dictionaryResponse.ok ? "사전 설명이 반환되지 않았습니다." : dictionaryResponse.error);
      }
      return dictionaryResponse.text;
    },
    onDictionarySave: async (term, sourceText, explanation) => {
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
  });
}

function sendBackground(message: unknown): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(message);
}
