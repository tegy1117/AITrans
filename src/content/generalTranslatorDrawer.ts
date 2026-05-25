import { mountGeneralTranslator, type GeneralTranslatorDraft, type GeneralTranslatorResult } from "../generalTranslatorDom";
import type { BackgroundResponse, ExtensionState, TranslationHistoryEntry } from "../shared/types";

const GENERAL_DRAWER_ATTR = "data-ai-general-translator-drawer";

export interface GeneralTranslatorDrawerCallbacks {
  sendBackground(message: unknown): Promise<BackgroundResponse>;
}

export async function showGeneralTranslatorDrawer(
  draft: GeneralTranslatorDraft,
  callbacks: GeneralTranslatorDrawerCallbacks
): Promise<void> {
  removeGeneralTranslatorDrawer();

  const drawer = document.createElement("aside");
  drawer.setAttribute(GENERAL_DRAWER_ATTR, "true");
  applyDrawerStyle(drawer);
  document.body.append(drawer);

  const stateResponse = await callbacks.sendBackground({ type: "getState" });
  const state = stateResponse.ok && stateResponse.state ? stateResponse.state : undefined;
  const history = state?.translationHistory ?? [];

  mountGeneralTranslator(drawer, {
    draft,
    history,
    profileOptions: createGeneralProfileOptions(state),
    activeProfileId: state?.activeProfileByPurpose.general ?? "",
    async onTranslate(text, profileId): Promise<GeneralTranslatorResult> {
      const response = await callbacks.sendBackground({ type: "translateGeneral", text, profileId });
      if (!response.ok || !response.text || !response.state) {
        throw new Error(response.ok ? "일반 번역 결과가 반환되지 않았습니다." : response.error);
      }
      return { translatedText: response.text, history: response.state.translationHistory };
    },
    async onDeleteHistory(id): Promise<TranslationHistoryEntry[]> {
      const response = await callbacks.sendBackground({ type: "deleteTranslationHistoryEntry", id });
      if (!response.ok || !response.state) throw new Error(response.ok ? "번역 기록을 삭제하지 못했습니다." : response.error);
      return response.state.translationHistory;
    },
    async onClearHistory(): Promise<TranslationHistoryEntry[]> {
      const response = await callbacks.sendBackground({ type: "clearTranslationHistory" });
      if (!response.ok || !response.state) throw new Error(response.ok ? "번역 기록을 비우지 못했습니다." : response.error);
      return response.state.translationHistory;
    },
    onClose: removeGeneralTranslatorDrawer
  });
}

export function removeGeneralTranslatorDrawer(): void {
  document.querySelector(`[${GENERAL_DRAWER_ATTR}]`)?.remove();
}

function applyDrawerStyle(drawer: HTMLElement): void {
  drawer.style.position = "fixed";
  drawer.style.zIndex = "2147483647";
  drawer.style.top = "0";
  drawer.style.right = "0";
  drawer.style.width = "420px";
  drawer.style.maxWidth = "calc(100vw - 16px)";
  drawer.style.height = "100vh";
  drawer.style.overflow = "auto";
  drawer.style.boxSizing = "border-box";
  drawer.style.padding = "14px";
  drawer.style.borderLeft = "1px solid #d7dde8";
  drawer.style.background = "#ffffff";
  drawer.style.boxShadow = "-12px 0 32px rgba(15, 23, 42, 0.18)";
  drawer.style.color = "#111827";
  drawer.style.font = "13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
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
