export interface TextReplacement {
  node: Text;
  originalText: string;
}

export interface HtmlTranslationItem {
  id: string;
  node: Text;
  originalText: string;
}

export interface HtmlTranslationPatch {
  html: string;
  items: HtmlTranslationItem[];
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);
const TRANSLATION_ROOT_TAG = "ai-translator-page";
const TRANSLATION_TEXT_TAG = "ai-t";
const TRANSLATION_TEXT_ID_ATTRIBUTE = "data-ai-translator-text-id";

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

export function createHtmlTranslationPatches(nodes: Text[], maxChars = 12000): HtmlTranslationPatch[] {
  const patches: HtmlTranslationPatch[] = [];
  let currentItems: HtmlTranslationItem[] = [];
  let currentHtml = "";

  nodes.forEach((node, index) => {
    const originalText = node.textContent ?? "";
    const item: HtmlTranslationItem = {
      id: `t${index + 1}`,
      node,
      originalText
    };
    const html = createTranslationTextElement(item.id, originalText);

    if (currentItems.length > 0 && estimatePatchLength(currentHtml, html) > maxChars) {
      patches.push(createPatch(currentItems, currentHtml));
      currentItems = [];
      currentHtml = "";
    }

    currentItems.push(item);
    currentHtml += html;
  });

  if (currentItems.length > 0) {
    patches.push(createPatch(currentItems, currentHtml));
  }

  return patches;
}

export function applyHtmlTranslationPatches(patches: HtmlTranslationPatch[], translatedHtmls: string[]): TextReplacement[] {
  const parsedPatches = patches.map((patch, patchIndex) => {
    const translated = parseTranslatedHtmlPatch(translatedHtmls[patchIndex] ?? "");
    if (patch.items.length > 0 && translated.size === 0) {
      throw new Error("번역 응답에서 HTML 패치 항목을 찾을 수 없습니다.");
    }
    return translated;
  });
  const replacements: TextReplacement[] = [];
  let translatedCount = 0;

  for (const [patchIndex, patch] of patches.entries()) {
    const translated = parsedPatches[patchIndex];

    for (const item of patch.items) {
      const originalText = item.node.textContent ?? "";
      const translatedText = translated.get(item.id);
      if (translatedText !== undefined) {
        item.node.textContent = translatedText;
        translatedCount += 1;
      }
      replacements.push({ node: item.node, originalText });
    }
  }

  if (patches.length > 0 && translatedCount === 0) {
    throw new Error("번역 응답에서 HTML 패치 항목을 찾을 수 없습니다.");
  }

  return replacements;
}

export function parseTranslatedHtmlPatch(html: string): Map<string, string> {
  const parser = new DOMParser();
  const document = parser.parseFromString(stripCodeFence(html), "text/html");
  const translated = new Map<string, string>();

  for (const element of Array.from(document.querySelectorAll(`${TRANSLATION_TEXT_TAG}[${TRANSLATION_TEXT_ID_ATTRIBUTE}]`))) {
    const id = element.getAttribute(TRANSLATION_TEXT_ID_ATTRIBUTE);
    if (id) translated.set(id, element.textContent ?? "");
  }

  return translated;
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

function createPatch(items: HtmlTranslationItem[], innerHtml: string): HtmlTranslationPatch {
  return {
    html: `<${TRANSLATION_ROOT_TAG}>${innerHtml}</${TRANSLATION_ROOT_TAG}>`,
    items
  };
}

function createTranslationTextElement(id: string, text: string): string {
  return `<${TRANSLATION_TEXT_TAG} ${TRANSLATION_TEXT_ID_ATTRIBUTE}="${id}">${escapeHtml(text)}</${TRANSLATION_TEXT_TAG}>`;
}

function estimatePatchLength(currentHtml: string, nextHtml: string): number {
  return currentHtml.length + nextHtml.length + `<${TRANSLATION_ROOT_TAG}></${TRANSLATION_ROOT_TAG}>`.length;
}

function stripCodeFence(html: string): string {
  const trimmed = html.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : html;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
