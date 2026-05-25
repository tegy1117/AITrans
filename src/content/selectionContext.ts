let lastSelectionAnchor: DOMRect | null = null;

export function rememberSelectionAnchor(selection: Selection | null = window.getSelection()): void {
  const text = selection?.toString().trim() ?? "";
  if (!selection || !text || selection.rangeCount === 0) return;

  lastSelectionAnchor = selection.getRangeAt(0).getBoundingClientRect();
}

export function getSelectionAnchor(): DOMRect {
  return lastSelectionAnchor ?? new DOMRect(16, 16, 0, 0);
}
