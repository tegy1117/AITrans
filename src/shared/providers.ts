import type { MessageRole, PromptMessage, ProviderConfig, ProviderImagePayload, RenderedPrompt } from "./types";

export interface ProviderHttpRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function buildProviderRequest(config: ProviderConfig, prompt: RenderedPrompt): ProviderHttpRequest {
  switch (config.type) {
    case "openai":
      return buildOpenAiCompatibleRequest(config, prompt, "https://api.openai.com/v1");
    case "custom-openai-compatible":
      return buildOpenAiCompatibleRequest(config, prompt, requireBaseUrl(config));
    case "ollama-cloud":
      return buildOpenAiCompatibleRequest(config, prompt, requireBaseUrl(config));
    case "ollama-local":
      return buildOllamaRequest(config, prompt);
    case "claude":
      return buildClaudeRequest(config, prompt);
    case "gemini":
      return buildGeminiRequest(config, prompt);
  }
}

export async function translateWithProvider(
  config: ProviderConfig,
  prompt: RenderedPrompt,
  fetcher: Fetcher = fetch
): Promise<string> {
  const request = buildProviderRequest(config, prompt);
  const response = await fetcher(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body)
  });

  if (!response.ok) {
    throw new Error(await formatProviderHttpError(response));
  }

  const data = (await response.json()) as unknown;
  return extractProviderText(config, data);
}

function buildOpenAiCompatibleRequest(
  config: ProviderConfig,
  prompt: RenderedPrompt,
  defaultBaseUrl: string
): ProviderHttpRequest {
  return {
    url: `${trimTrailingSlash(config.baseUrl ?? defaultBaseUrl)}/chat/completions`,
    headers: withBearer(config.apiKey),
    body: {
      model: prompt.model,
      messages: buildOpenAiMessages(prompt),
      temperature: prompt.parameters.temperature,
      top_p: prompt.parameters.topP,
      max_tokens: prompt.parameters.maxTokens,
      max_completion_tokens: prompt.parameters.maxOutputTokens,
      reasoning_effort: prompt.parameters.reasoningEffort
    }
  };
}

function buildOllamaRequest(config: ProviderConfig, prompt: RenderedPrompt): ProviderHttpRequest {
  return {
    url: `${trimTrailingSlash(config.baseUrl ?? "http://localhost:11434")}/api/chat`,
    headers: { "Content-Type": "application/json" },
    body: {
      model: prompt.model,
      messages: buildOllamaMessages(prompt),
      stream: false,
      options: {
        temperature: prompt.parameters.temperature,
        top_p: prompt.parameters.topP,
        num_predict: prompt.parameters.maxOutputTokens ?? prompt.parameters.maxTokens
      }
    }
  };
}

function buildClaudeRequest(config: ProviderConfig, prompt: RenderedPrompt): ProviderHttpRequest {
  const system = prompt.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const messages = buildClaudeMessages(prompt);

  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": config.apiKey ?? ""
    },
    body: {
      model: prompt.model,
      max_tokens: prompt.parameters.maxOutputTokens ?? prompt.parameters.maxTokens ?? 1024,
      temperature: prompt.parameters.temperature,
      top_p: prompt.parameters.topP,
      system: system || undefined,
      messages
    }
  };
}

function buildGeminiRequest(config: ProviderConfig, prompt: RenderedPrompt): ProviderHttpRequest {
  const apiKey = config.apiKey ?? "";
  const contents = buildGeminiContents(prompt);
  const systemInstruction = prompt.messages.find((message) => message.role === "system")?.content;

  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      prompt.model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    headers: { "Content-Type": "application/json" },
    body: {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: prompt.parameters.temperature,
        topP: prompt.parameters.topP,
        maxOutputTokens: prompt.parameters.maxOutputTokens ?? prompt.parameters.maxTokens
      }
    }
  };
}

function extractProviderText(config: ProviderConfig, data: unknown): string {
  if (config.type === "claude") {
    const content = readPath(data, ["content"]);
    if (Array.isArray(content)) {
      return content.map((part) => readPath(part, ["text"])).filter(isString).join("\n").trim();
    }
  }

  if (config.type === "gemini") {
    const candidates = readPath(data, ["candidates"]);
    if (Array.isArray(candidates)) {
      return candidates
        .flatMap((candidate) => {
          const parts = readPath(candidate, ["content", "parts"]);
          return Array.isArray(parts) ? parts.map((part) => readPath(part, ["text"])) : [];
        })
        .filter(isString)
        .join("\n")
        .trim();
    }
  }

  if (config.type === "ollama-local") {
    const content = readPath(data, ["message", "content"]);
    if (isString(content)) return content;
  }

  if (isOpenAiCompatible(config.type)) {
    const content = readPath(data, ["choices", 0, "message", "content"]);
    if (isString(content) && content.trim()) return content;
    throw new Error("OpenAI-compatible response did not include choices[0].message.content.");
  }

  throw new Error("Provider response did not contain translated text.");
}

function buildOpenAiMessages(prompt: RenderedPrompt): unknown[] {
  return attachImageToLastUserMessage(prompt.messages, prompt.image, (message, image) => ({
    role: message.role,
    content: [
      { type: "text", text: message.content },
      { type: "image_url", image_url: { url: image.dataUrl } }
    ]
  }));
}

function buildClaudeMessages(prompt: RenderedPrompt): unknown[] {
  const messages = prompt.messages.filter((message) => message.role !== "system");
  return attachImageToLastUserMessage(messages, prompt.image, (message, image) => ({
    role: message.role,
    content: [
      { type: "text", text: message.content },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mimeType,
          data: image.base64
        }
      }
    ]
  }));
}

function buildGeminiContents(prompt: RenderedPrompt): unknown[] {
  const messages = prompt.messages.filter((message) => message.role !== "system");
  return attachImageToLastUserMessage(messages, prompt.image, (message, image) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }]
  })).map((message) => {
    if (typeof message === "object" && message !== null && "parts" in message) return message;
    const promptMessage = message as PromptMessage;
    return {
      role: promptMessage.role === "assistant" ? "model" : "user",
      parts: [{ text: promptMessage.content }]
    };
  });
}

function buildOllamaMessages(prompt: RenderedPrompt): unknown[] {
  return attachImageToLastUserMessage(prompt.messages, prompt.image, (message, image) => ({
    ...message,
    images: [image.base64]
  }));
}

function attachImageToLastUserMessage(
  messages: PromptMessage[],
  image: ProviderImagePayload | undefined,
  renderImageMessage: (message: PromptMessage, image: ProviderImagePayload) => unknown
): unknown[] {
  if (!image) return messages;

  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex === -1) {
    return [...messages, renderImageMessage({ role: "user", content: "" }, image)];
  }

  return messages.map((message, index) => (index === lastUserIndex ? renderImageMessage(message, image) : message));
}

function findLastUserMessageIndex(messages: Array<{ role: MessageRole }>): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }
  return -1;
}

async function formatProviderHttpError(response: Response): Promise<string> {
  const details = await readProviderErrorDetails(response);
  const statusLabel = response.statusText ? `${response.status} ${response.statusText}` : String(response.status);
  return details ? `Provider request failed with HTTP ${statusLabel}: ${details}` : `Provider request failed with HTTP ${statusLabel}`;
}

async function readProviderErrorDetails(response: Response): Promise<string | null> {
  const body = await response.text().catch(() => "");
  if (!body.trim()) return null;

  try {
    const parsed = JSON.parse(body) as unknown;
    const message = readPath(parsed, ["error", "message"]);
    if (isString(message) && message.trim()) return message;
  } catch {
    return body.slice(0, 500);
  }

  return body.slice(0, 500);
}

function withBearer(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function requireBaseUrl(config: ProviderConfig): string {
  if (!config.baseUrl) throw new Error(`${config.name} requires a base URL.`);
  return config.baseUrl;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function readPath(value: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOpenAiCompatible(type: ProviderConfig["type"]): boolean {
  return type === "openai" || type === "custom-openai-compatible" || type === "ollama-cloud";
}
