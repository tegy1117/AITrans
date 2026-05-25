import "./styles.css";
import { mountDictionaryApp } from "./dictionaryDom";
import type { BackgroundResponse } from "./shared/types";

void initialize();

async function initialize(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#dictionaryApp");
  if (!root) throw new Error("Dictionary root element is missing.");

  const stateResponse = (await chrome.runtime.sendMessage({ type: "getState" })) as BackgroundResponse;
  if (!stateResponse.ok || !stateResponse.state) {
    root.textContent = stateResponse.ok ? "사전 데이터를 불러올 수 없습니다." : stateResponse.error;
    return;
  }

  mountDictionaryApp(root, stateResponse.state.dictionaryEntries, {
    async onDelete(id) {
      const deleteResponse = (await chrome.runtime.sendMessage({ type: "deleteDictionaryEntry", id })) as BackgroundResponse;
      if (!deleteResponse.ok) throw new Error(deleteResponse.error);
      return deleteResponse.state?.dictionaryEntries ?? [];
    }
  });
}
