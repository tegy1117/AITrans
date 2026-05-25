export interface ExtensionPageNavigationApi {
  runtime: Pick<typeof chrome.runtime, "getURL">;
  tabs: Pick<typeof chrome.tabs, "create">;
}

export function openExtensionPageInNewTab(path: string, api: ExtensionPageNavigationApi): void {
  void api.tabs.create({ url: api.runtime.getURL(path) });
}
