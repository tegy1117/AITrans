import type { GeneralTranslatorDisplayMode } from "../shared/types";

export interface OpenGeneralTranslatorSurfaceOptions {
  displayMode: GeneralTranslatorDisplayMode;
  sourceText: string;
  translatedText: string;
  tabId?: number;
  sendMessage(tabId: number, message: unknown): Promise<unknown> | void;
  createWindow(options: chrome.windows.CreateData): Promise<unknown> | void;
  getExtensionUrl(path: string): string;
}

export async function openGeneralTranslatorSurface(options: OpenGeneralTranslatorSurfaceOptions): Promise<void> {
  if (options.displayMode === "window") {
    await openPopupWindow(options);
    return;
  }

  if (!options.tabId) {
    await openPopupWindow(options);
    return;
  }

  try {
    await options.sendMessage(options.tabId, {
      type: "openGeneralTranslatorDrawer",
      sourceText: options.sourceText,
      translatedText: options.translatedText
    });
  } catch {
    await openPopupWindow(options);
  }
}

async function openPopupWindow(options: OpenGeneralTranslatorSurfaceOptions): Promise<void> {
  const params = new URLSearchParams();
  if (options.sourceText) params.set("sourceText", options.sourceText);
  if (options.translatedText) params.set("translatedText", options.translatedText);
  const suffix = params.toString() ? `?${params.toString()}` : "";

  await options.createWindow({
    url: options.getExtensionUrl(`translator.html${suffix}`),
    type: "popup",
    width: 520,
    height: 720
  });
}
