import { renderPrompt } from "./shared/prompt";
import { translateWithProvider } from "./shared/providers";
import { loadState, saveState, trimTranslationHistory } from "./shared/storage";
import type { BackgroundRequest, BackgroundResponse, ExtensionState, ProfilePurpose } from "./shared/types";
import { createContextMenuClickHandler, createTranslationContextMenus, sendTabMessage } from "./background/contextMenus";
import { fetchImagePayload } from "./background/images";
import { openGeneralTranslatorSurface } from "./background/generalTranslatorOpen";
import { installBackgroundRuntimeErrorGuard } from "./background/runtimeErrors";
import { sendTabRequestToContentScript } from "./background/tabMessaging";

installBackgroundRuntimeErrorGuard();

chrome.runtime.onInstalled.addListener(async () => {
  await loadState();
  createTranslationContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createTranslationContextMenus();
});

chrome.contextMenus.onClicked.addListener(createContextMenuClickHandler());

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  return true;
});

async function handleMessage(request: BackgroundRequest, sender?: chrome.runtime.MessageSender): Promise<BackgroundResponse> {
  if (request.type === "getState") {
    return { ok: true, state: await loadState() };
  }

  if (request.type === "saveState") {
    await saveState(request.state);
    return { ok: true, state: request.state };
  }

  if (request.type === "translatePage") {
    const texts = await Promise.all(request.texts.map((text) => translate("page", text)));
    return { ok: true, texts };
  }

  if (request.type === "translateSelection") {
    return { ok: true, text: await translate("selection", request.text) };
  }

  if (request.type === "translateImage") {
    return { ok: true, text: await translateImage(request.imageUrl) };
  }

  if (request.type === "translateGeneral") {
    return translateGeneral(request.text, request.profileId);
  }

  if (request.type === "deleteTranslationHistoryEntry") {
    const state = await loadState();
    const nextState: ExtensionState = {
      ...state,
      translationHistory: state.translationHistory.filter((entry) => entry.id !== request.id)
    };
    await saveState(nextState);
    return { ok: true, state: nextState };
  }

  if (request.type === "clearTranslationHistory") {
    const state = await loadState();
    const nextState: ExtensionState = { ...state, translationHistory: [] };
    await saveState(nextState);
    return { ok: true, state: nextState };
  }

  if (request.type === "openGeneralTranslator") {
    await openGeneralTranslator(request.sourceText ?? "", request.translatedText ?? "", sender);
    return { ok: true };
  }

  if (request.type === "getYouTubeCaptionTracks") {
    return sendTabRequestToContentScript(request.tabId, { type: "getYouTubeCaptionTracks" });
  }

  if (request.type === "startYouTubeCaptionTranslation") {
    return sendTabRequestToContentScript(request.tabId, { type: "startYouTubeCaptionTranslation", trackId: request.trackId });
  }

  if (request.type === "stopYouTubeCaptionTranslation") {
    return sendTabRequestToContentScript(request.tabId, { type: "stopYouTubeCaptionTranslation" });
  }

  if (request.type === "translateYouTubeCaptionBatch") {
    return { ok: true, text: await translate("youtube-caption", request.content) };
  }

  if (request.type === "generateDictionaryEntry") {
    return { ok: true, text: await generateDictionaryEntry(request.term, request.sourceText, request.translationContext, request.termSource) };
  }

  if (request.type === "saveDictionaryEntry") {
    const state = await loadState();
    const nextState: ExtensionState = {
      ...state,
      dictionaryEntries: [request.entry, ...state.dictionaryEntries.filter((entry) => entry.id !== request.entry.id)]
    };
    await saveState(nextState);
    return { ok: true, state: nextState };
  }

  if (request.type === "deleteDictionaryEntry") {
    const state = await loadState();
    const nextState: ExtensionState = {
      ...state,
      dictionaryEntries: state.dictionaryEntries.filter((entry) => entry.id !== request.id)
    };
    await saveState(nextState);
    return { ok: true, state: nextState };
  }

  if (request.type === "restorePage") {
    return { ok: true };
  }

  return { ok: false, error: "Unknown request." };
}

async function translate(purpose: ProfilePurpose, content: string): Promise<string> {
  const state = await loadState();
  const profile = findActiveProfile(state, purpose);
  const provider = state.providerConfigs.find((config) => config.id === profile.providerId);
  if (!provider) throw new Error(`Provider ${profile.providerId} is not configured.`);

  const prompt = renderPrompt(profile, { content });
  return translateWithProvider(provider, prompt);
}

async function translateImage(imageUrl: string): Promise<string> {
  if (!imageUrl.trim()) throw new Error("번역할 이미지 URL이 없습니다.");

  const state = await loadState();
  const profile = findActiveProfile(state, "image");
  const provider = state.providerConfigs.find((config) => config.id === profile.providerId);
  if (!provider) throw new Error(`Provider ${profile.providerId} is not configured.`);

  const image = await fetchImagePayload(imageUrl);
  const prompt = {
    ...renderPrompt(profile, { content: "이미지에서 읽을 수 있는 텍스트를 자연스러운 한국어로 번역해 주세요." }),
    image
  };
  return translateWithProvider(provider, prompt);
}

async function generateDictionaryEntry(
  term: string,
  sourceText: string,
  translationContext?: string,
  termSource: "source" | "translation" = "translation"
): Promise<string> {
  const trimmedTerm = term.trim();
  if (!trimmedTerm) throw new Error("사전에 추가할 단어를 입력해 주세요.");

  const state = await loadState();
  const profile = findActiveProfile(state, termSource === "source" ? "dictionary-source" : "dictionary");
  const provider = state.providerConfigs.find((config) => config.id === profile.providerId);
  if (!provider) throw new Error(`Provider ${profile.providerId} is not configured.`);

  const prompt = renderPrompt(profile, {
    content: sourceText,
    dictContent: trimmedTerm,
    translationContext: translationContext ?? ""
  });
  return translateWithProvider(provider, prompt);
}

async function translateGeneral(text: string, profileId?: string): Promise<BackgroundResponse> {
  const sourceText = text.trim();
  if (!sourceText) throw new Error("번역할 텍스트를 입력해 주세요.");

  const state = await loadState();
  const profile = findGeneralProfile(state, profileId);
  const provider = state.providerConfigs.find((config) => config.id === profile.providerId);
  if (!provider) throw new Error(`Provider ${profile.providerId} is not configured.`);

  const prompt = renderPrompt(profile, { content: sourceText });
  const translatedText = await translateWithProvider(provider, prompt);
  const entry = {
    id: crypto.randomUUID(),
    sourceText,
    translatedText,
    createdAt: new Date().toISOString(),
    profileId: profile.id,
    profileName: profile.name,
    providerId: provider.id,
    model: profile.model
  };
  const nextState: ExtensionState = {
    ...state,
    translationHistory: trimTranslationHistory([entry, ...state.translationHistory])
  };
  await saveState(nextState);
  return { ok: true, text: translatedText, state: nextState };
}

async function openGeneralTranslator(sourceText: string, translatedText: string, sender?: chrome.runtime.MessageSender): Promise<void> {
  const state = await loadState();
  const tabId = sender?.tab?.id;
  await openGeneralTranslatorSurface({
    displayMode: state.generalTranslatorDisplayMode,
    sourceText,
    translatedText,
    tabId,
    sendMessage: sendTabMessage,
    createTab: (options) => chrome.tabs.create(options),
    getExtensionUrl: chrome.runtime.getURL
  });
}

function findGeneralProfile(state: ExtensionState, profileId?: string) {
  if (profileId) {
    const profile = state.promptProfiles.find((candidate) => candidate.id === profileId && candidate.purpose === "general");
    if (!profile) throw new Error("선택한 일반 번역 프로필을 찾을 수 없습니다.");
    return profile;
  }
  return findActiveProfile(state, "general");
}

function findActiveProfile(state: ExtensionState, purpose: ProfilePurpose) {
  const profileId = state.activeProfileByPurpose[purpose];
  const profile = state.promptProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`No active ${purpose} prompt profile is configured.`);
  return profile;
}
