export interface PageTranslationOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  delay?(ms: number): Promise<void>;
}

export async function translatePageTexts(
  texts: string[],
  translateText: (text: string) => Promise<string>,
  options: PageTranslationOptions = {}
): Promise<string[]> {
  const translated: string[] = [];
  for (const text of texts) {
    translated.push(await translateWithRetry(text, translateText, options));
  }
  return translated;
}

export async function translatePageHtmlPatches(
  htmlPatches: string[],
  translatePatch: (content: string) => Promise<string>,
  options: PageTranslationOptions = {}
): Promise<string[]> {
  const translated: string[] = [];
  for (const htmlPatch of htmlPatches) {
    translated.push(await translateWithRetry(createPageHtmlPatchPrompt(htmlPatch), translatePatch, options));
  }
  return translated;
}

export function createPageHtmlPatchPrompt(htmlPatch: string): string {
  return [
    "다음은 웹페이지에서 CSS와 JavaScript를 제외하고 추출한 HTML 번역 패치입니다.",
    "태그 구조와 속성, 특히 data-ai-translator-text-id 값은 절대 바꾸지 마세요.",
    "<ai-t> 태그 내부의 사람이 읽는 텍스트만 자연스러운 한국어로 번역하세요.",
    "번역하지 말아야 할 코드, URL, 속성 이름, 태그 이름은 그대로 유지하세요.",
    "설명, 마크다운 코드블록, 요약을 붙이지 말고 HTML만 반환하세요.",
    "",
    htmlPatch
  ].join("\n");
}

async function translateWithRetry(
  text: string,
  translateText: (text: string) => Promise<string>,
  options: PageTranslationOptions
): Promise<string> {
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 800;
  const delay = options.delay ?? defaultDelay;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await translateText(text);
    } catch (error) {
      if (attempt >= maxRetries || !isTransientProviderLimit(error)) throw error;
      await delay(retryDelayMs * (attempt + 1));
    }
  }
}

function isTransientProviderLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b/.test(message) || /too many concurrent requests/i.test(message);
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
