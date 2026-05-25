import "./styles.css";
import type { BackgroundRequest, BackgroundResponse, ExtensionState, YouTubeCaptionTrack } from "./shared/types";
import { openExtensionPageInNewTab } from "./popup/navigation";
import { defaultYouTubeCaptionTrackId, isYouTubeWatchUrl, renderYouTubeCaptionControls } from "./popup/youtubeCaptions";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const summary = document.querySelector<HTMLParagraphElement>("#profileSummary")!;
const youtubeCaptionSection = document.querySelector<HTMLElement>("#youtubeCaptionSection")!;

let youtubeCaptionTabId: number | null = null;
let youtubeCaptionTracks: YouTubeCaptionTrack[] = [];
let selectedYouTubeCaptionTrackId = "";

void initialize();

document.querySelector("#translatePage")?.addEventListener("click", async () => {
  await sendToActiveTab({ type: "translateCurrentPage" });
});

document.querySelector("#restorePage")?.addEventListener("click", async () => {
  await sendToActiveTab({ type: "restoreCurrentPage" });
});

document.querySelector("#openGeneralTranslator")?.addEventListener("click", async () => {
  setStatus("일반 번역창을 여는 중...");
  const response = (await chrome.runtime.sendMessage({ type: "openGeneralTranslator" })) as BackgroundResponse;
  setStatus(response.ok ? "일반 번역창을 열었습니다." : response.error);
});

document.querySelector("#openDictionary")?.addEventListener("click", () => {
  openExtensionPageInNewTab("dictionary.html", chrome);
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
  await initializeYouTubeCaptionSection();
}

function renderState(state: ExtensionState): void {
  const pageProfile = state.promptProfiles.find((profile) => profile.id === state.activeProfileByPurpose.page);
  const selectionProfile = state.promptProfiles.find((profile) => profile.id === state.activeProfileByPurpose.selection);
  summary.textContent = `페이지: ${pageProfile?.name ?? "미설정"} | 선택 번역: ${selectionProfile?.name ?? "미설정"}`;
}

async function sendToActiveTab(message: unknown): Promise<void> {
  setStatus("처리 중...");
  const tab = await getActiveTab();
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

async function initializeYouTubeCaptionSection(): Promise<void> {
  const tab = await getActiveTab();
  youtubeCaptionTabId = tab.id ?? null;

  if (!youtubeCaptionTabId || !isYouTubeWatchUrl(tab.url)) {
    renderYouTubeCaptionSection(false, "YouTube 영상 페이지에서 사용할 수 있습니다.");
    return;
  }

  renderYouTubeCaptionSection(true, "자막 트랙을 불러오는 중...");
  await refreshYouTubeCaptionTracks();
}

async function refreshYouTubeCaptionTracks(): Promise<void> {
  if (!youtubeCaptionTabId) return;

  renderYouTubeCaptionSection(true, "자막 트랙을 불러오는 중...");
  const response = await sendRuntime({ type: "getYouTubeCaptionTracks", tabId: youtubeCaptionTabId });
  if (!response.ok) {
    youtubeCaptionTracks = [];
    selectedYouTubeCaptionTrackId = "";
    renderYouTubeCaptionSection(true, response.error);
    return;
  }

  youtubeCaptionTracks = response.tracks ?? [];
  selectedYouTubeCaptionTrackId = response.selectedTrackId ?? defaultYouTubeCaptionTrackId(youtubeCaptionTracks);
  renderYouTubeCaptionSection(
    true,
    youtubeCaptionTracks.length > 0 ? "자막 트랙을 선택한 뒤 번역을 시작하세요." : "자막 스크립트를 가져올 수 없습니다."
  );
}

async function startYouTubeCaptionTranslation(trackId: string): Promise<void> {
  if (!youtubeCaptionTabId || !trackId) return;

  selectedYouTubeCaptionTrackId = trackId;
  renderYouTubeCaptionSection(true, "전체 자막을 AI로 번역하는 중입니다. 영상 길이에 따라 시간이 걸릴 수 있습니다.");
  const response = await sendRuntime({ type: "startYouTubeCaptionTranslation", tabId: youtubeCaptionTabId, trackId });
  renderYouTubeCaptionSection(true, response.ok ? "AI 자막 번역을 켰습니다." : response.error);
}

async function stopYouTubeCaptionTranslation(): Promise<void> {
  if (!youtubeCaptionTabId) return;

  const response = await sendRuntime({ type: "stopYouTubeCaptionTranslation", tabId: youtubeCaptionTabId });
  renderYouTubeCaptionSection(true, response.ok ? "AI 자막 번역을 껐습니다." : response.error);
}

function renderYouTubeCaptionSection(isYouTubeWatch: boolean, sectionStatus: string): void {
  renderYouTubeCaptionControls(
    youtubeCaptionSection,
    {
      isYouTubeWatch,
      tracks: youtubeCaptionTracks,
      selectedTrackId: selectedYouTubeCaptionTrackId,
      status: sectionStatus
    },
    {
      onRefresh: () => void refreshYouTubeCaptionTracks(),
      onStart: (trackId) => void startYouTubeCaptionTranslation(trackId),
      onStop: () => void stopYouTubeCaptionTranslation()
    }
  );
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendRuntime(message: BackgroundRequest): Promise<BackgroundResponse> {
  try {
    return (await chrome.runtime.sendMessage(message)) as BackgroundResponse;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
