export const SELECTION_TRANSLATE_MENU_ID = "ai-translator-translate-selection";
export const IMAGE_TRANSLATE_MENU_ID = "ai-translator-translate-image";

export interface ContextMenuApi {
  create(properties: chrome.contextMenus.CreateProperties): void;
  removeAll(callback: () => void): void;
}
type SendTabMessage = (tabId: number, message: unknown) => Promise<unknown> | void;

export function createTranslationContextMenus(api: ContextMenuApi = chrome.contextMenus): void {
  api.removeAll(() => {
    api.create({
      id: SELECTION_TRANSLATE_MENU_ID,
      title: "선택한 텍스트 AI로 번역",
      contexts: ["selection"]
    });
    api.create({
      id: IMAGE_TRANSLATE_MENU_ID,
      title: "이미지 AI로 번역",
      contexts: ["image"]
    });
  });
}

export async function handleTranslationContextMenuClick(
  info: Pick<chrome.contextMenus.OnClickData, "menuItemId" | "selectionText" | "srcUrl">,
  tab: Pick<chrome.tabs.Tab, "id"> | undefined,
  sendMessage: SendTabMessage = chrome.tabs.sendMessage
): Promise<void> {
  if (!tab?.id) return;

  if (info.menuItemId === SELECTION_TRANSLATE_MENU_ID) {
    if (!info.selectionText?.trim()) return;

    await sendMessage(tab.id, {
      type: "translateSelectedTextFromContextMenu",
      text: info.selectionText.trim()
    });
    return;
  }

  if (info.menuItemId === IMAGE_TRANSLATE_MENU_ID) {
    if (!info.srcUrl?.trim()) return;

    await sendMessage(tab.id, {
      type: "translateImageFromContextMenu",
      imageUrl: info.srcUrl.trim()
    });
  }
}

export const createSelectionContextMenu = createTranslationContextMenus;
export const handleSelectionContextMenuClick = handleTranslationContextMenuClick;
