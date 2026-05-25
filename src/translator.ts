import "./styles.css";
import { mountGeneralTranslator, type GeneralTranslatorResult } from "./generalTranslatorDom";
import type { BackgroundResponse, ExtensionState, TranslationHistoryEntry } from "./shared/types";

void initialize();

async function initialize(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#translatorApp");
  if (!root) throw new Error("Translator root element is missing.");

  const params = new URLSearchParams(location.search);
  const stateResponse = (await chrome.runtime.sendMessage({ type: "getState" })) as BackgroundResponse;
  const state = stateResponse.ok && stateResponse.state ? stateResponse.state : undefined;
  const history = state?.translationHistory ?? [];

  mountGeneralTranslator(root, {
    draft: {
      sourceText: params.get("sourceText") ?? "",
      translatedText: params.get("translatedText") ?? ""
    },
    history,
    profileOptions: createGeneralProfileOptions(state),
    activeProfileId: state?.activeProfileByPurpose.general ?? "",
    async onTranslate(text, profileId): Promise<GeneralTranslatorResult> {
      const response = (await chrome.runtime.sendMessage({ type: "translateGeneral", text, profileId })) as BackgroundResponse;
      if (!response.ok || !response.text || !response.state) {
        throw new Error(response.ok ? "일반 번역 결과가 반환되지 않았습니다." : response.error);
      }
      return { translatedText: response.text, history: response.state.translationHistory };
    },
    async onDeleteHistory(id): Promise<TranslationHistoryEntry[]> {
      const response = (await chrome.runtime.sendMessage({ type: "deleteTranslationHistoryEntry", id })) as BackgroundResponse;
      if (!response.ok || !response.state) throw new Error(response.ok ? "번역 기록을 삭제하지 못했습니다." : response.error);
      return response.state.translationHistory;
    },
    async onClearHistory(): Promise<TranslationHistoryEntry[]> {
      const response = (await chrome.runtime.sendMessage({ type: "clearTranslationHistory" })) as BackgroundResponse;
      if (!response.ok || !response.state) throw new Error(response.ok ? "번역 기록을 비우지 못했습니다." : response.error);
      return response.state.translationHistory;
    }
  });
}

function createGeneralProfileOptions(state: ExtensionState | undefined) {
  if (!state) return [];
  return state.promptProfiles
    .filter((profile) => profile.purpose === "general")
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      model: profile.model,
      providerName: state.providerConfigs.find((provider) => provider.id === profile.providerId)?.name
    }));
}
