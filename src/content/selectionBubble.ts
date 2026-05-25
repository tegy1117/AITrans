export type BubbleState = "loading" | "translated" | "error";

export interface SelectionBubbleOptions {
  anchor: DOMRect;
  state: BubbleState;
  text: string;
  sourceText?: string;
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
