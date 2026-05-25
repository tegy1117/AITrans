import type { TranslationHistoryEntry } from "./shared/types";

export interface GeneralTranslatorDraft {
  sourceText?: string;
  translatedText?: string;
  profileId?: string;
}

export interface GeneralTranslatorResult {
  translatedText: string;
  history: TranslationHistoryEntry[];
}

export interface GeneralTranslatorProfileOption {
  id: string;
  name: string;
  model: string;
  providerName?: string;
}

export interface GeneralTranslatorCallbacks {
  draft: GeneralTranslatorDraft;
  history: TranslationHistoryEntry[];
  profileOptions: GeneralTranslatorProfileOption[];
  activeProfileId: string;
  onTranslate(text: string, profileId: string): Promise<GeneralTranslatorResult>;
  onDeleteHistory(id: string): Promise<TranslationHistoryEntry[]>;
  onClearHistory(): Promise<TranslationHistoryEntry[]>;
  onClose?: () => void;
}

export function mountGeneralTranslator(root: HTMLElement, callbacks: GeneralTranslatorCallbacks): void {
  let history = callbacks.history;
  let translatedText = callbacks.draft.translatedText ?? "";
  let selectedProfileId = resolveInitialProfileId(callbacks);
  let statusMessage = "";
  let isLoading = false;

  render();

  function render(): void {
    root.replaceChildren();
    const wrapper = document.createElement("section");
    wrapper.dataset.role = "general-translator";
    wrapper.style.display = "grid";
    wrapper.style.gap = "10px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    const title = document.createElement("h2");
    title.textContent = "일반 번역";
    header.append(title);
    if (callbacks.onClose) header.append(button("닫기", "close-general-translator", callbacks.onClose));

    const input = document.createElement("textarea");
    input.dataset.role = "general-source";
    input.rows = 8;
    input.value = callbacks.draft.sourceText ?? "";
    input.placeholder = "번역할 텍스트를 입력하세요.";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    const profileSelect = profileSelectRow();

    const result = document.createElement("div");
    result.dataset.role = "general-result";
    result.textContent = translatedText || "번역 결과가 여기에 표시됩니다.";
    result.style.whiteSpace = "pre-wrap";
    result.style.border = "1px solid #d7dde8";
    result.style.borderRadius = "8px";
    result.style.padding = "10px";
    result.style.background = "#f8fafc";

    const actions = row([
      button("번역", "general-translate", async () => {
        const sourceText = input.value.trim();
        if (!sourceText || isLoading) return;
        isLoading = true;
        callbacks.draft.sourceText = sourceText;
        statusMessage = "번역 중...";
        render();
        try {
          callbacks.draft.profileId = selectedProfileId;
          const response = await callbacks.onTranslate(sourceText, selectedProfileId);
          translatedText = response.translatedText;
          history = response.history;
          callbacks.draft.sourceText = sourceText;
          callbacks.draft.translatedText = response.translatedText;
          statusMessage = "번역했습니다.";
        } catch (error) {
          statusMessage = error instanceof Error ? error.message : String(error);
        } finally {
          isLoading = false;
          render();
        }
      }),
      button("복사", "general-copy", () => void navigator.clipboard?.writeText(translatedText), !translatedText)
    ]);

    const status = document.createElement("p");
    status.role = "status";
    status.textContent = statusMessage;

    const historySection = document.createElement("section");
    const historyTitle = document.createElement("h3");
    historyTitle.textContent = "번역 기록";
    const historyList = document.createElement("div");
    historyList.dataset.role = "general-history";
    renderHistory(historyList);
    historySection.append(historyTitle, row([button("전체 삭제", "clear-general-history", clearHistory, history.length === 0)]), historyList);

    wrapper.append(header, profileSelect, input, actions, result, status, historySection);
    root.append(wrapper);
  }

  function profileSelectRow(): HTMLElement {
    const label = document.createElement("label");
    label.textContent = "번역 프로필";
    label.style.display = "grid";
    label.style.gap = "4px";

    const select = document.createElement("select");
    select.dataset.role = "general-profile";
    select.replaceChildren(
      ...callbacks.profileOptions.map((profile) => {
        const meta = [profile.providerName, profile.model].filter(Boolean).join(" / ");
        return new Option(meta ? `${profile.name} (${meta})` : profile.name, profile.id);
      })
    );
    select.value = selectedProfileId;
    select.addEventListener("change", () => {
      selectedProfileId = select.value;
      callbacks.draft.profileId = selectedProfileId;
    });
    label.append(select);
    return label;
  }

  function renderHistory(historyList: HTMLElement): void {
    historyList.replaceChildren();
    if (history.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "아직 번역 기록이 없습니다.";
      historyList.append(empty);
      return;
    }

    for (const entry of history) {
      const item = document.createElement("article");
      item.style.border = "1px solid #d7dde8";
      item.style.borderRadius = "8px";
      item.style.padding = "8px";
      item.style.marginTop = "8px";
      const source = document.createElement("p");
      source.textContent = entry.sourceText;
      const translated = document.createElement("p");
      translated.textContent = entry.translatedText;
      const meta = document.createElement("p");
      meta.dataset.role = "general-history-profile";
      meta.textContent = `프로필: ${entry.profileName || entry.profileId}`;
      meta.style.color = "#64748b";
      meta.style.fontSize = "12px";
      item.append(source, translated, meta, row([button("삭제", "delete-general-history", () => void deleteHistory(entry.id))]));
      historyList.append(item);
    }
  }

  async function deleteHistory(id: string): Promise<void> {
    history = await callbacks.onDeleteHistory(id);
    render();
  }

  async function clearHistory(): Promise<void> {
    history = await callbacks.onClearHistory();
    render();
  }
}

function resolveInitialProfileId(callbacks: GeneralTranslatorCallbacks): string {
  const ids = new Set(callbacks.profileOptions.map((profile) => profile.id));
  if (callbacks.draft.profileId && ids.has(callbacks.draft.profileId)) return callbacks.draft.profileId;
  if (callbacks.activeProfileId && ids.has(callbacks.activeProfileId)) return callbacks.activeProfileId;
  return callbacks.profileOptions[0]?.id ?? "";
}

function button(label: string, action: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.dataset.action = action;
  node.disabled = disabled;
  node.addEventListener("click", onClick);
  return node;
}

function row(children: HTMLElement[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.gap = "8px";
  wrapper.style.justifyContent = "flex-end";
  wrapper.append(...children);
  return wrapper;
}
