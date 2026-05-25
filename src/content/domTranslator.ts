export interface TextReplacement {
  node: Text;
  originalText: string;
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);

export function collectTranslatableTextNodes(root: ParentNode): Text[] {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    (node) => {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  );

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

export function replaceTextNodes(nodes: Text[], translations: string[]): TextReplacement[] {
  return nodes.map((node, index) => {
    const originalText = node.textContent ?? "";
    node.textContent = translations[index] ?? originalText;
    return { node, originalText };
  });
}

export function restoreTextNodes(replacements: TextReplacement[]): void {
  for (const replacement of replacements) {
    replacement.node.textContent = replacement.originalText;
  }
}

export function createBatches(texts: string[], maxChars = 6000): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const text of texts) {
    if (current.length > 0 && currentLength + text.length > maxChars) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }

    current.push(text);
    currentLength += text.length;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

function shouldSkipNode(node: Node): boolean {
  let current = node.parentElement;

  while (current) {
    if (SKIP_TAGS.has(current.tagName)) return true;
    if (current.getAttribute("contenteditable") === "true") return true;
    if (current.getAttribute("aria-hidden") === "true") return true;
    current = current.parentElement;
  }

  return false;
}
