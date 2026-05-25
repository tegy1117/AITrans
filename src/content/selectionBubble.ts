export type BubbleState = "loading" | "translated" | "error";

export interface SelectionBubbleOptions {
  anchor: DOMRect;
  state: BubbleState;
  text: string;
  sourceText?: string;
  onDictionaryRequest?: (term: string, sourceText: string) => Promise<string>;
  onDictionarySave?: (term: string, sourceText: string, explanation: string) => Promise<void>;
}

const BUBBLE_ATTR = "data-ai-translator-bubble";

export function showSelectionBubble(options: SelectionBubbleOptions): void {
  removeSelectionBubble();
  if (options.state === "translated" && !options.text.trim()) return;

  const bubble = document.createElement("div");
  bubble.setAttribute(BUBBLE_ATTR, "true");
  bubble.style.position = "fixed";
  bubble.style.zIndex = "2147483647";
  bubble.style.left = `${Math.max(8, options.anchor.left)}px`;
  bubble.style.top = `${Math.max(8, options.anchor.bottom + 8)}px`;
  bubble.style.maxWidth = "420px";
  bubble.style.padding = "12px";
  bubble.style.border = "1px solid #d7dde8";
  bubble.style.borderRadius = "8px";
  bubble.style.background = "#ffffff";
  bubble.style.boxShadow = "0 12px 32px rgba(15, 23, 42, 0.18)";
  bubble.style.color = "#111827";
  bubble.style.font = "13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const text = document.createElement("div");
  text.textContent = labelFor(options);
  text.style.whiteSpace = "pre-wrap";
  bubble.append(text);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.justifyContent = "flex-end";
  actions.style.gap = "8px";
  actions.style.marginTop = "10px";

  if (options.state === "translated") {
    actions.append(createButton("복사", "copy", () => void navigator.clipboard?.writeText(options.text)));
    if (options.onDictionaryRequest && options.onDictionarySave) {
      actions.append(createButton("사전", "dictionary", () => openDictionaryPanel(bubble, options)));
    }
  }
  actions.append(createButton("닫기", "close", removeSelectionBubble));
  bubble.append(actions);

  document.body.append(bubble);
}

export function removeSelectionBubble(): void {
  document.querySelector(`[${BUBBLE_ATTR}]`)?.remove();
}

function labelFor(options: SelectionBubbleOptions): string {
  if (options.state === "loading") return "번역 중...";
  if (options.state === "error") return options.text || "번역에 실패했습니다.";
  return options.text;
}

function createButton(label: string, action: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.style.border = "1px solid #cbd5e1";
  button.style.borderRadius = "6px";
  button.style.background = "#f8fafc";
  button.style.padding = "4px 8px";
  button.style.cursor = "pointer";
  button.addEventListener("click", onClick);
  return button;
}

function openDictionaryPanel(bubble: HTMLElement, options: SelectionBubbleOptions): void {
  bubble.querySelector("[data-role='dictionary-panel']")?.remove();

  const panel = document.createElement("div");
  panel.dataset.role = "dictionary-panel";
  panel.style.marginTop = "10px";
  panel.style.paddingTop = "10px";
  panel.style.borderTop = "1px solid #e5e7eb";

  const label = document.createElement("label");
  label.textContent = "사전에 추가할 단어";
  label.style.display = "grid";
  label.style.gap = "6px";

  const input = document.createElement("input");
  input.type = "text";
  input.dataset.role = "dictionary-term";
  input.value = window.getSelection()?.toString().trim() ?? "";
  input.style.border = "1px solid #cbd5e1";
  input.style.borderRadius = "6px";
  input.style.padding = "6px 8px";
  label.append(input);

  const result = document.createElement("div");
  result.dataset.role = "dictionary-result";
  result.style.marginTop = "8px";
  result.style.whiteSpace = "pre-wrap";

  let explanation = "";
  const sourceText = options.sourceText ?? options.text;

  const generate = createButton("생성", "generate-dictionary", async () => {
    const term = input.value.trim();
    if (!term) {
      result.textContent = "사전에 추가할 단어를 입력해 주세요.";
      return;
    }

    result.textContent = "사전 설명 생성 중...";
    try {
      explanation = await options.onDictionaryRequest!(term, sourceText);
      result.textContent = explanation;
      renderSaveActions(panel, input, sourceText, () => explanation, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.textContent = `사전 설명 생성에 실패했습니다: ${message}`;
    }
  });

  panel.append(label, row([generate]), result);
  bubble.append(panel);
  input.focus();
}

function renderSaveActions(
  panel: HTMLElement,
  input: HTMLInputElement,
  sourceText: string,
  explanation: () => string,
  options: SelectionBubbleOptions
): void {
  panel.querySelector("[data-role='dictionary-save-actions']")?.remove();

  const actions = row([
    createButton("저장", "save-dictionary", async () => {
      await options.onDictionarySave!(input.value.trim(), sourceText, explanation());
      const result = panel.querySelector<HTMLElement>("[data-role='dictionary-result']");
      if (result) result.textContent = "사전 항목을 저장했습니다.";
      actions.remove();
    }),
    createButton("취소", "cancel-dictionary", () => panel.remove())
  ]);
  actions.dataset.role = "dictionary-save-actions";
  panel.append(actions);
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
