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
    wrapper.className = "translator-shell";
    setStyle(wrapper, {
      display: "grid",
      gap: "16px",
      color: "#202124"
    });

    const header = renderHeader();
    const board = document.createElement("div");
    board.dataset.role = "general-board";
    board.className = "translator-board";
    setStyle(board, {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      gap: "12px",
      alignItems: "stretch"
    });

    const input = renderInput();
    const sourcePanel = renderSourcePanel(input);
    const resultPanel = renderResultPanel();
    board.append(sourcePanel, resultPanel);

    const status = document.createElement("p");
    status.role = "status";
    status.className = statusMessage.includes("실패") || statusMessage.includes("invalid") ? "translator-status error" : "translator-status";
    status.textContent = statusMessage;

    wrapper.append(header, board, status, renderHistorySection());
    root.append(wrapper);
  }

  function renderHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "translator-header";
    setStyle(header, {
      display: "grid",
      gap: "12px"
    });

    const topRow = document.createElement("div");
    topRow.className = "translator-top-row";
    setStyle(topRow, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px"
    });

    const modeGroup = document.createElement("div");
    modeGroup.className = "translator-mode-group";
    setStyle(modeGroup, {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      flexWrap: "wrap"
    });

    const mode = document.createElement("button");
    mode.type = "button";
    mode.className = "translator-mode active";
    mode.textContent = "텍스트";
    mode.disabled = true;
    setStyle(mode, {
      width: "auto",
      borderRadius: "999px",
      padding: "8px 14px",
      color: "#0b57d0",
      background: "#dbeafe",
      border: "1px solid #bfdbfe",
      cursor: "default"
    });
    modeGroup.append(mode);

    const title = document.createElement("h2");
    title.textContent = "일반 번역";
    title.className = "translator-title";
    setStyle(title, {
      margin: "0",
      fontSize: "18px",
      fontWeight: "650"
    });

    topRow.append(modeGroup, title);
    if (callbacks.onClose) topRow.append(button("닫기", "close-general-translator", callbacks.onClose, false, "ghost"));

    const profileBar = document.createElement("div");
    profileBar.className = "translator-profile-bar";
    setStyle(profileBar, {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      flexWrap: "wrap"
    });
    profileBar.append(profileSelectRow(), button(isLoading ? "번역 중..." : "번역", "general-translate", translateCurrentInput, isLoading, "primary"));

    header.append(topRow, profileBar);
    return header;
  }

  function profileSelectRow(): HTMLElement {
    const label = document.createElement("label");
    label.className = "translator-profile-label";
    label.textContent = "번역 프로필";
    setStyle(label, {
      display: "grid",
      gap: "6px",
      flex: "1 1 280px",
      margin: "0",
      color: "#5f6368",
      fontSize: "13px"
    });

    const select = document.createElement("select");
    select.dataset.role = "general-profile";
    select.className = "translator-profile-select";
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

  function renderInput(): HTMLTextAreaElement {
    const input = document.createElement("textarea");
    input.dataset.role = "general-source";
    input.className = "translator-input";
    input.rows = 10;
    input.value = callbacks.draft.sourceText ?? "";
    input.placeholder = "번역할 텍스트를 입력하세요.";
    setStyle(input, {
      width: "100%",
      minHeight: "210px",
      border: "0",
      resize: "vertical",
      outline: "0",
      padding: "16px",
      background: "transparent",
      fontSize: "18px",
      lineHeight: "1.55"
    });
    return input;
  }

  function renderSourcePanel(input: HTMLTextAreaElement): HTMLElement {
    const panel = panelShell("translator-source-panel");
    panel.append(panelHeader("입력", sourceMeta(input.value)), input, panelFooter([
      button("비우기", "general-clear", () => {
        callbacks.draft.sourceText = "";
        callbacks.draft.translatedText = "";
        translatedText = "";
        render();
      }, !input.value.trim(), "ghost")
    ]));
    return panel;
  }

  function renderResultPanel(): HTMLElement {
    const panel = panelShell("translator-result-panel");
    const result = document.createElement("div");
    result.dataset.role = "general-result";
    result.className = translatedText ? "translator-result" : "translator-result placeholder";
    result.textContent = translatedText || "번역 결과가 여기에 표시됩니다.";
    setStyle(result, {
      minHeight: "210px",
      padding: "16px",
      whiteSpace: "pre-wrap",
      fontSize: "18px",
      lineHeight: "1.55",
      color: translatedText ? "#202124" : "#6b7280"
    });

    panel.append(panelHeader("번역", selectedProfileName()), result, panelFooter([
      button("복사", "general-copy", () => void navigator.clipboard?.writeText(translatedText), !translatedText, "ghost")
    ]));
    return panel;
  }

  function panelShell(extraClass: string): HTMLElement {
    const panel = document.createElement("section");
    panel.className = `translator-panel ${extraClass}`;
    setStyle(panel, {
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
      minHeight: "320px",
      border: "1px solid #dadce0",
      borderRadius: "10px",
      overflow: "hidden",
      background: extraClass.includes("result") ? "#f1f5f9" : "#ffffff"
    });
    return panel;
  }

  function panelHeader(title: string, meta: string): HTMLElement {
    const header = document.createElement("div");
    header.className = "translator-panel-header";
    setStyle(header, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "8px",
      padding: "11px 14px",
      borderBottom: "1px solid #e5e7eb",
      color: "#1a73e8",
      fontSize: "14px",
      fontWeight: "650"
    });

    const label = document.createElement("span");
    label.textContent = title;
    const metaNode = document.createElement("span");
    metaNode.textContent = meta;
    setStyle(metaNode, {
      color: "#6b7280",
      fontSize: "12px",
      fontWeight: "400"
    });
    header.append(label, metaNode);
    return header;
  }

  function panelFooter(actions: HTMLButtonElement[]): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "translator-panel-footer";
    setStyle(footer, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      minHeight: "44px",
      padding: "8px 10px",
      borderTop: "1px solid #e5e7eb"
    });
    footer.append(...actions);
    return footer;
  }

  async function translateCurrentInput(): Promise<void> {
    const input = root.querySelector<HTMLTextAreaElement>("[data-role='general-source']");
    const sourceText = input?.value.trim() ?? "";
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
  }

  function renderHistorySection(): HTMLElement {
    const historySection = document.createElement("section");
    historySection.className = "translator-history-section";
    setStyle(historySection, {
      display: "grid",
      gap: "12px",
      marginTop: "10px"
    });

    const header = document.createElement("div");
    header.className = "translator-history-header";
    setStyle(header, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px"
    });

    const historyTitle = document.createElement("h3");
    historyTitle.textContent = "번역 기록";
    setStyle(historyTitle, {
      margin: "0",
      fontSize: "16px"
    });
    header.append(historyTitle, button("전체 삭제", "clear-general-history", clearHistory, history.length === 0, "ghost"));

    const historyList = document.createElement("div");
    historyList.dataset.role = "general-history";
    historyList.className = "translator-history";
    renderHistory(historyList);

    historySection.append(header, historyList);
    return historySection;
  }

  function renderHistory(historyList: HTMLElement): void {
    historyList.replaceChildren();
    if (history.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "아직 번역 기록이 없습니다.";
      empty.className = "translator-empty";
      historyList.append(empty);
      return;
    }

    for (const entry of history) {
      const item = document.createElement("article");
      item.className = "translator-history-item";
      setStyle(item, {
        display: "grid",
        gap: "8px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "12px",
        marginTop: "8px",
        background: "#ffffff"
      });
      const source = document.createElement("p");
      source.textContent = entry.sourceText;
      source.className = "translator-history-source";
      const translated = document.createElement("p");
      translated.textContent = entry.translatedText;
      translated.className = "translator-history-result";
      const meta = document.createElement("p");
      meta.dataset.role = "general-history-profile";
      meta.className = "translator-history-meta";
      meta.textContent = `프로필: ${entry.profileName || entry.profileId}`;
      setStyle(meta, {
        margin: "0",
        color: "#64748b",
        fontSize: "12px"
      });
      item.append(source, translated, meta, row([button("삭제", "delete-general-history", () => void deleteHistory(entry.id), false, "ghost")]));
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

  function selectedProfileName(): string {
    return callbacks.profileOptions.find((profile) => profile.id === selectedProfileId)?.name ?? "선택한 프로필";
  }
}

function sourceMeta(value: string): string {
  const length = value.trim().length;
  return length > 0 ? `${length.toLocaleString()}자` : "텍스트";
}

function resolveInitialProfileId(callbacks: GeneralTranslatorCallbacks): string {
  const ids = new Set(callbacks.profileOptions.map((profile) => profile.id));
  if (callbacks.draft.profileId && ids.has(callbacks.draft.profileId)) return callbacks.draft.profileId;
  if (callbacks.activeProfileId && ids.has(callbacks.activeProfileId)) return callbacks.activeProfileId;
  return callbacks.profileOptions[0]?.id ?? "";
}

function button(label: string, action: string, onClick: () => void, disabled = false, variant: "primary" | "ghost" = "primary"): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.dataset.action = action;
  node.disabled = disabled;
  node.className = `translator-button ${variant}`;
  setStyle(node, {
    width: "auto",
    minWidth: variant === "primary" ? "92px" : "auto",
    border: variant === "primary" ? "1px solid #1a73e8" : "1px solid #dadce0",
    borderRadius: "999px",
    padding: "8px 14px",
    color: variant === "primary" ? "#ffffff" : "#3c4043",
    background: variant === "primary" ? "#1a73e8" : "#ffffff",
    cursor: disabled ? "not-allowed" : "pointer"
  });
  node.addEventListener("click", onClick);
  return node;
}

function row(children: HTMLElement[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "translator-action-row";
  setStyle(wrapper, {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    flexWrap: "wrap"
  });
  wrapper.append(...children);
  return wrapper;
}

function setStyle(node: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(node.style, styles);
}
