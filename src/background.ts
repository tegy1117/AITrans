import { renderPrompt } from "./shared/prompt";
import { translateWithProvider } from "./shared/providers";
import { loadState, saveState } from "./shared/storage";
import type { BackgroundRequest, BackgroundResponse, ExtensionState, ProfilePurpose } from "./shared/types";
import { createSelectionContextMenu, handleSelectionContextMenuClick } from "./background/contextMenus";

chrome.runtime.onInstalled.addListener(async () => {
  await loadState();
  createSelectionContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  createSelectionContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleSelectionContextMenuClick(info, tab);
});

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  return true;
});

async function handleMessage(request: BackgroundRequest): Promise<BackgroundResponse> {
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

  if (request.type === "generateDictionaryEntry") {
    return { ok: true, text: await generateDictionaryEntry(request.term, request.sourceText) };
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

async function generateDictionaryEntry(term: string, sourceText: string): Promise<string> {
  const trimmedTerm = term.trim();
  if (!trimmedTerm) throw new Error("사전에 추가할 단어를 입력해 주세요.");

  const state = await loadState();
  const profile = findActiveProfile(state, "dictionary");
  const provider = state.providerConfigs.find((config) => config.id === profile.providerId);
  if (!provider) throw new Error(`Provider ${profile.providerId} is not configured.`);

  const prompt = renderPrompt(profile, { content: sourceText, dictContent: trimmedTerm });
  return translateWithProvider(provider, prompt);
}

function findActiveProfile(state: ExtensionState, purpose: ProfilePurpose) {
  const profileId = state.activeProfileByPurpose[purpose];
  const profile = state.promptProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`No active ${purpose} prompt profile is configured.`);
  return profile;
}
