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
