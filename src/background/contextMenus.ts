export const SELECTION_TRANSLATE_MENU_ID = "ai-translator-translate-selection";

export interface ContextMenuApi {
  create(properties: chrome.contextMenus.CreateProperties): void;
  removeAll(callback: () => void): void;
}
type SendTabMessage = (tabId: number, message: unknown) => Promise<unknown> | void;

export function createSelectionContextMenu(api: ContextMenuApi = chrome.contextMenus): void {
  api.removeAll(() => {
    api.create({
      id: SELECTION_TRANSLATE_MENU_ID,
      title: "선택한 텍스트 AI로 번역",
      contexts: ["selection"]
    });
  });
}

export async function handleSelectionContextMenuClick(
  info: Pick<chrome.contextMenus.OnClickData, "menuItemId" | "selectionText">,
  tab: Pick<chrome.tabs.Tab, "id"> | undefined,
  sendMessage: SendTabMessage = chrome.tabs.sendMessage
): Promise<void> {
  if (info.menuItemId !== SELECTION_TRANSLATE_MENU_ID) return;
  if (!tab?.id || !info.selectionText?.trim()) return;

  await sendMessage(tab.id, {
    type: "translateSelectedTextFromContextMenu",
    text: info.selectionText.trim()
  });
}
