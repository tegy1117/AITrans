import "./styles.css";
import type { BackgroundResponse, ExtensionState } from "./shared/types";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const summary = document.querySelector<HTMLParagraphElement>("#profileSummary")!;

void initialize();

document.querySelector("#translatePage")?.addEventListener("click", async () => {
  await sendToActiveTab({ type: "translateCurrentPage" });
});

document.querySelector("#restorePage")?.addEventListener("click", async () => {
  await sendToActiveTab({ type: "restoreCurrentPage" });
});

document.querySelector("#openOptions")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function initialize(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "getState" })) as BackgroundResponse;
  if (!response.ok || !response.state) {
    setStatus(response.ok ? "설정을 불러올 수 없습니다." : response.error);
    return;
  }
  renderState(response.state);
}

function renderState(state: ExtensionState): void {
  const pageProfile = state.promptProfiles.find((profile) => profile.id === state.activeProfileByPurpose.page);
  const selectionProfile = state.promptProfiles.find((profile) => profile.id === state.activeProfileByPurpose.selection);
  summary.textContent = `페이지: ${pageProfile?.name ?? "미설정"} | 선택 번역: ${selectionProfile?.name ?? "미설정"}`;
}

async function sendToActiveTab(message: unknown): Promise<void> {
  setStatus("처리 중...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    setStatus("활성 탭을 찾을 수 없습니다.");
    return;
  }
  const response = await chrome.tabs.sendMessage(tab.id, message).catch((error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }));
  setStatus(response.ok ? "완료되었습니다." : response.error);
}

function setStatus(message: string): void {
  status.textContent = message;
}
