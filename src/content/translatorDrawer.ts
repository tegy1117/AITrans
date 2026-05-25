export type DrawerState = "loading" | "translated" | "error";
export type DictionaryCandidateStatus = "pending" | "generated" | "error" | "saved";

export interface HighlightedTerm {
  id: string;
  term: string;
}

export interface DictionaryCandidate {
  id: string;
  term: string;
  sourceText: string;
  status: DictionaryCandidateStatus;
  explanation?: string;
  error?: string;
}

export interface TranslatorDrawerOptions {
  state: DrawerState;
  text: string;
  sourceText?: string;
  onDictionaryRequest?: (term: string, sourceText: string) => Promise<string>;
  onDictionarySave?: (term: string, sourceText: string, explanation: string) => Promise<void>;
}

const DRAWER_ATTR = "data-ai-translator-drawer";

export function showTranslatorDrawer(options: TranslatorDrawerOptions): void {
  removeTranslatorDrawer();

  const drawer = document.createElement("aside");
  drawer.setAttribute(DRAWER_ATTR, "true");
  applyDrawerStyle(drawer);

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.gap = "8px";

  const title = document.createElement("strong");
  title.textContent = "AI 번역";
  header.append(title, createIconButton("닫기", "close", removeTranslatorDrawer));
  drawer.append(header);

  if (options.state === "loading" || options.state === "error") {
    const status = document.createElement("p");
    status.textContent = options.state === "loading" ? "번역 중..." : options.text || "번역에 실패했습니다.";
    status.style.whiteSpace = "pre-wrap";
    drawer.append(status);
    document.body.append(drawer);
    return;
  }

  if (!options.text.trim()) return;

  renderTranslatedDrawer(drawer, options);
  document.body.append(drawer);
}

export function removeTranslatorDrawer(): void {
  document.querySelector(`[${DRAWER_ATTR}]`)?.remove();
}

function renderTranslatedDrawer(drawer: HTMLElement, options: TranslatorDrawerOptions): void {
  const terms: HighlightedTerm[] = [];
  const candidates = new Map<string, DictionaryCandidate>();
  const sourceText = options.sourceText ?? options.text;

  const result = document.createElement("div");
  result.dataset.role = "drawer-result";
  result.textContent = options.text;
  result.style.whiteSpace = "pre-wrap";
  result.style.userSelect = "text";
  result.style.border = "1px solid #d7dde8";
  result.style.borderRadius = "8px";
  result.style.padding = "10px";
  result.style.background = "#f8fafc";
  result.addEventListener("mouseup", () => {
    const selected = window.getSelection()?.toString().trim();
    if (!selected || !result.textContent?.includes(selected)) return;
    if (terms.some((term) => term.term === selected)) return;
    terms.push({ id: createId("term"), term: selected });
    renderTerms();
  });

  const actions = row([
    createButton("복사", "copy", () => void navigator.clipboard?.writeText(options.text)),
    createButton("사전 생성", "generate-dictionaries", async () => {
      if (!options.onDictionaryRequest) return;
      await generateCandidates(terms, candidates, sourceText, options.onDictionaryRequest, renderCandidates);
    })
  ]);

  const termsSection = document.createElement("section");
  const termsTitle = document.createElement("h3");
  termsTitle.textContent = "선택한 텍스트";
  const termsList = document.createElement("div");
  termsList.dataset.role = "highlighted-terms";
  termsSection.append(termsTitle, termsList);

  const candidatesSection = document.createElement("section");
  const candidatesTitle = document.createElement("h3");
  candidatesTitle.textContent = "사전 후보";
  const candidatesList = document.createElement("div");
  candidatesList.dataset.role = "dictionary-candidates";
  candidatesSection.append(candidatesTitle, candidatesList);

  drawer.append(result, actions, termsSection, candidatesSection);
  renderTerms();
  renderCandidates();

  function renderTerms(): void {
    termsList.replaceChildren();
    if (terms.length === 0) {
      termsList.append(muted("번역 결과에서 단어 또는 문장을 드래그해 선택하세요."));
      return;
    }

    for (const term of terms) {
      const chip = document.createElement("span");
      chip.dataset.role = "highlighted-term";
      chip.style.display = "inline-flex";
      chip.style.alignItems = "center";
      chip.style.gap = "6px";
      chip.style.margin = "0 6px 6px 0";
      chip.style.padding = "4px 8px";
      chip.style.borderRadius = "999px";
      chip.style.background = "#dbeafe";
      chip.style.color = "#1e3a8a";

      const label = document.createElement("span");
      label.dataset.role = "highlighted-term-label";
      label.textContent = term.term;

      const remove = createIconButton("삭제", "remove-highlighted-term", () => {
        const index = terms.findIndex((candidate) => candidate.id === term.id);
        if (index >= 0) terms.splice(index, 1);
        candidates.delete(term.term);
        renderTerms();
        renderCandidates();
      });
      remove.style.width = "auto";
      remove.style.padding = "0 4px";
      chip.append(label, remove);
      termsList.append(chip);
    }
  }

  function renderCandidates(): void {
    candidatesList.replaceChildren();
    if (candidates.size === 0) {
      candidatesList.append(muted("선택한 텍스트로 사전을 생성하면 여기에 표시됩니다."));
      return;
    }

    for (const candidate of candidates.values()) {
      candidatesList.append(renderCandidate(candidate, options, candidates, renderCandidates));
    }
  }
}

async function generateCandidates(
  terms: HighlightedTerm[],
  candidates: Map<string, DictionaryCandidate>,
  sourceText: string,
  request: (term: string, sourceText: string) => Promise<string>,
  render: () => void
): Promise<void> {
  for (const term of terms) {
    const candidate: DictionaryCandidate = {
      id: createId("candidate"),
      term: term.term,
      sourceText,
      status: "pending"
    };
    candidates.set(term.term, candidate);
    render();

    try {
      candidate.explanation = await request(term.term, sourceText);
      candidate.status = "generated";
    } catch (error) {
      candidate.status = "error";
      candidate.error = error instanceof Error ? error.message : String(error);
    }
    render();
  }
}

function renderCandidate(
  candidate: DictionaryCandidate,
  options: TranslatorDrawerOptions,
  candidates: Map<string, DictionaryCandidate>,
  render: () => void
): HTMLElement {
  const item = document.createElement("article");
  item.style.border = "1px solid #d7dde8";
  item.style.borderRadius = "8px";
  item.style.padding = "10px";
  item.style.marginTop = "8px";

  const title = document.createElement("strong");
  title.textContent = candidate.term;
  item.append(title);

  const body = document.createElement("p");
  body.style.whiteSpace = "pre-wrap";
  body.textContent =
    candidate.status === "pending"
      ? "사전 설명 생성 중..."
      : candidate.status === "error"
        ? `생성 실패: ${candidate.error ?? "알 수 없는 오류"}`
        : candidate.explanation ?? "";
  item.append(body);

  const actions: HTMLElement[] = [
    createButton("삭제", "delete-dictionary-candidate", () => {
      candidates.delete(candidate.term);
      render();
    })
  ];

  if (candidate.status === "generated" && candidate.explanation && options.onDictionarySave) {
    actions.unshift(
      createButton("저장", "save-dictionary-candidate", async () => {
        await options.onDictionarySave!(candidate.term, candidate.sourceText, candidate.explanation!);
        candidate.status = "saved";
        render();
      })
    );
  }

  if (candidate.status === "saved") {
    const saved = muted("저장되었습니다.");
    item.append(saved);
  }

  item.append(row(actions));
  return item;
}

function applyDrawerStyle(drawer: HTMLElement): void {
  drawer.style.position = "fixed";
  drawer.style.zIndex = "2147483647";
  drawer.style.top = "0";
  drawer.style.right = "0";
  drawer.style.width = "360px";
  drawer.style.maxWidth = "calc(100vw - 16px)";
  drawer.style.height = "100vh";
  drawer.style.overflow = "auto";
  drawer.style.boxSizing = "border-box";
  drawer.style.padding = "14px";
  drawer.style.borderLeft = "1px solid #d7dde8";
  drawer.style.background = "#ffffff";
  drawer.style.boxShadow = "-12px 0 32px rgba(15, 23, 42, 0.18)";
  drawer.style.color = "#111827";
  drawer.style.font = "13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}

function createButton(label: string, action: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.style.border = "1px solid #cbd5e1";
  button.style.borderRadius = "6px";
  button.style.background = "#f8fafc";
  button.style.padding = "6px 8px";
  button.style.cursor = "pointer";
  button.addEventListener("click", onClick);
  return button;
}

function createIconButton(label: string, action: string, onClick: () => void): HTMLButtonElement {
  return createButton(label, action, onClick);
}

function row(children: HTMLElement[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.justifyContent = "flex-end";
  wrapper.style.gap = "8px";
  wrapper.style.marginTop = "8px";
  wrapper.append(...children);
  return wrapper;
}

function muted(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "8px 0";
  paragraph.style.color = "#64748b";
  return paragraph;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
