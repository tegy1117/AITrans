import type { BackgroundResponse, DictionaryTermSource, YouTubeCaptionPosition, YouTubeCaptionTrack } from "./shared/types";
import { collectTranslatableTextNodes, createBatches, replaceTextNodes, restoreTextNodes, type TextReplacement } from "./content/domTranslator";
import { showTranslatorDrawer } from "./content/translatorDrawer";
import { showSelectionBubble } from "./content/selectionBubble";
import { getSelectionAnchor, rememberSelectionAnchor } from "./content/selectionContext";
import { showGeneralTranslatorDrawer } from "./content/generalTranslatorDrawer";
import {
  createNumberedCaptionBatches,
  extractCaptionTracksFromDocument,
  fetchCaptionFragments,
  findYouTubePlayerRoot,
  findYouTubeVideo,
  mergeCaptionFragmentsIntoSentences,
  parseNumberedCaptionResponse,
  removeYouTubeCaptionOverlay,
  renderYouTubeCaptionOverlay,
  type YouTubeCaptionSentence
} from "./content/youtubeCaptions";

let replacements: TextReplacement[] = [];
let youtubeCaptionSession: { intervalId: number; player: HTMLElement } | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "aiTranslatorContentReady") {
    sendResponse({ ok: true });
    return false;
  }

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

  if (message?.type === "openGeneralTranslatorDrawer") {
    showGeneralTranslatorDrawer(
      {
        sourceText: String(message.sourceText ?? ""),
        translatedText: String(message.translatedText ?? "")
      },
      { sendBackground }
    )
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "getYouTubeCaptionTracks") {
    sendResponse(getYouTubeCaptionTracksResponse());
    return false;
  }

  if (message?.type === "startYouTubeCaptionTranslation") {
    startYouTubeCaptionTranslation(String(message.trackId ?? ""))
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        stopYouTubeCaptionTranslation();
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });
    return true;
  }

  if (message?.type === "stopYouTubeCaptionTranslation") {
    stopYouTubeCaptionTranslation();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

document.addEventListener("selectionchange", () => rememberSelectionAnchor());
document.addEventListener("contextmenu", () => {
  rememberSelectionAnchor();
});
window.addEventListener("yt-navigate-start", () => stopYouTubeCaptionTranslation());

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

  const displayMode = await getSelectionResultDisplayMode();
  const anchor = getSelectionAnchor();
  if (displayMode === "bubble") {
    showSelectionBubble({ anchor, state: "loading", text: "" });
  } else {
    showTranslatorDrawer({ state: "loading", text: "" });
  }

  const response = await sendBackground({ type: "translateSelection", text: trimmed });
  if (!response.ok || !response.text) {
    const errorText = response.ok ? "선택 번역 결과가 반환되지 않았습니다." : response.error;
    if (displayMode === "bubble") {
      showSelectionBubble({ anchor, state: "error", text: errorText });
    } else {
      showTranslatorDrawer({ state: "error", text: errorText });
    }
    return;
  }

  const translatedText = response.text;
  const drawerOptions = {
    state: "translated" as const,
    text: translatedText,
    sourceText: trimmed,
    ...dictionaryCallbacks(),
    onOpenGeneralTranslator: openGeneralTranslator
  };

  if (displayMode === "bubble") {
    showSelectionBubble({
      anchor,
      state: "translated",
      text: translatedText,
      sourceText: trimmed,
      onOpenDictionaryDrawer: () => showTranslatorDrawer(drawerOptions),
      onOpenGeneralTranslator: () => openGeneralTranslator(trimmed, translatedText)
    });
    return;
  }

  showTranslatorDrawer({
    ...drawerOptions
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
    ...dictionaryCallbacks(),
    onOpenGeneralTranslator: openGeneralTranslator
  });
}

function sendBackground(message: unknown): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(message);
}

async function getSelectionResultDisplayMode(): Promise<"drawer" | "bubble"> {
  try {
    const response = await sendBackground({ type: "getState" });
    return response.ok && response.state?.selectionResultDisplayMode === "bubble" ? "bubble" : "drawer";
  } catch {
    return "drawer";
  }
}

function dictionaryCallbacks() {
  return {
    onDictionaryRequest: async (term: string, sourceText: string, translationContext: string, termSource: DictionaryTermSource) => {
      const dictionaryResponse = await sendBackground({ type: "generateDictionaryEntry", term, sourceText, translationContext, termSource });
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

function openGeneralTranslator(sourceText: string, translatedText: string): void {
  void sendBackground({ type: "openGeneralTranslator", sourceText, translatedText });
}

function getYouTubeCaptionTracksResponse(): BackgroundResponse {
  const tracks = extractCaptionTracksFromDocument(document);
  if (tracks.length === 0) {
    return { ok: false, error: "자막 스크립트를 가져올 수 없습니다." };
  }

  return { ok: true, tracks, selectedTrackId: tracks[0]?.id };
}

async function startYouTubeCaptionTranslation(trackId: string): Promise<void> {
  stopYouTubeCaptionTranslation();

  const tracks = extractCaptionTracksFromDocument(document);
  if (tracks.length === 0) throw new Error("자막 스크립트를 가져올 수 없습니다.");

  const track = findCaptionTrack(tracks, trackId);
  if (!track) throw new Error("선택한 자막 트랙을 찾을 수 없습니다.");

  const player = findYouTubePlayerRoot(document);
  const video = findYouTubeVideo(document);
  if (!player || !video) throw new Error("유튜브 플레이어를 찾을 수 없습니다.");

  renderYouTubeCaptionOverlay(player, await getYouTubeCaptionPosition(), "AI 자막을 번역하는 중...");

  const fragments = await fetchCaptionFragments(track);
  const sentences = mergeCaptionFragmentsIntoSentences(fragments);
  if (sentences.length === 0) throw new Error("자막 스크립트를 가져올 수 없습니다.");

  const translations = await translateYouTubeCaptionSentences(sentences);
  const position = await getYouTubeCaptionPosition();
  youtubeCaptionSession = {
    player,
    intervalId: window.setInterval(() => {
      renderActiveYouTubeCaption(player, video, sentences, translations, position);
    }, 250)
  };
  renderActiveYouTubeCaption(player, video, sentences, translations, position);
}

function stopYouTubeCaptionTranslation(): void {
  if (youtubeCaptionSession) {
    window.clearInterval(youtubeCaptionSession.intervalId);
    removeYouTubeCaptionOverlay(youtubeCaptionSession.player);
    youtubeCaptionSession = null;
    return;
  }
  removeYouTubeCaptionOverlay(document);
}

async function translateYouTubeCaptionSentences(sentences: YouTubeCaptionSentence[]): Promise<Map<string, string>> {
  const translations = new Map<string, string>();

  for (const batch of createNumberedCaptionBatches(sentences)) {
    const response = await sendBackground({ type: "translateYouTubeCaptionBatch", content: batch.content });
    if (!response.ok || !response.text) {
      throw new Error(response.ok ? "유튜브 자막 번역 결과가 반환되지 않았습니다." : response.error);
    }

    for (const translation of parseNumberedCaptionResponse(response.text, batch)) {
      if (translation.text) translations.set(translation.id, translation.text);
    }
  }

  return translations;
}

function renderActiveYouTubeCaption(
  player: HTMLElement,
  video: HTMLVideoElement,
  sentences: YouTubeCaptionSentence[],
  translations: Map<string, string>,
  position: YouTubeCaptionPosition
): void {
  const currentMs = video.currentTime * 1000;
  const sentence = sentences.find((candidate) => candidate.startMs <= currentMs && currentMs <= candidate.endMs + 500);
  const text = sentence ? translations.get(sentence.id) : "";

  if (!text) {
    removeYouTubeCaptionOverlay(player);
    return;
  }

  renderYouTubeCaptionOverlay(player, position, text);
}

async function getYouTubeCaptionPosition(): Promise<YouTubeCaptionPosition> {
  try {
    const response = await sendBackground({ type: "getState" });
    return response.ok && response.state?.youtubeCaptionPosition === "above" ? "above" : "below";
  } catch {
    return "below";
  }
}

function findCaptionTrack(tracks: YouTubeCaptionTrack[], trackId: string): YouTubeCaptionTrack | undefined {
  return tracks.find((track) => track.id === trackId) ?? tracks[0];
}
