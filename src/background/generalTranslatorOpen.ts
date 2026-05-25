import type { GeneralTranslatorDisplayMode } from "../shared/types";

export interface OpenGeneralTranslatorSurfaceOptions {
  displayMode: GeneralTranslatorDisplayMode;
  sourceText: string;
  translatedText: string;
  tabId?: number;
  sendMessage(tabId: number, message: unknown): Promise<unknown> | void;
  createTab(options: chrome.tabs.CreateProperties): Promise<unknown> | void;
  getExtensionUrl(path: string): string;
}

export async function openGeneralTranslatorSurface(options: OpenGeneralTranslatorSurfaceOptions): Promise<void> {
  if (options.displayMode === "tab") {
    await openTranslatorTab(options);
    return;
  }

  if (!options.tabId) {
    await openTranslatorTab(options);
    return;
  }

  try {
    await options.sendMessage(options.tabId, {
      type: "openGeneralTranslatorDrawer",
      sourceText: options.sourceText,
      translatedText: options.translatedText
    });
  } catch {
    await openTranslatorTab(options);
  }
}

async function openTranslatorTab(options: OpenGeneralTranslatorSurfaceOptions): Promise<void> {
  const params = new URLSearchParams();
  if (options.sourceText) params.set("sourceText", options.sourceText);
  if (options.translatedText) params.set("translatedText", options.translatedText);
  const suffix = params.toString() ? `?${params.toString()}` : "";

  await options.createTab({ url: options.getExtensionUrl(`translator.html${suffix}`), active: true });
}
