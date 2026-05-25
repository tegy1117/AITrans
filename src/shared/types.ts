export type ProfilePurpose = "page" | "selection" | "image" | "dictionary";

export type SelectionResultDisplayMode = "drawer" | "bubble";

export type MessageRole = "system" | "user" | "assistant";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type ProviderType =
  | "openai"
  | "claude"
  | "gemini"
  | "ollama-local"
  | "ollama-cloud"
  | "custom-openai-compatible";

export interface PromptMessage {
  role: MessageRole;
  content: string;
}

export interface GenerationParameters {
  maxTokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  reasoningEffort?: ReasoningEffort;
}

export interface PromptProfile {
  id: string;
  purpose: ProfilePurpose;
  name: string;
  providerId: string;
  model: string;
  parameters: GenerationParameters;
  messages: PromptMessage[];
}

export interface RenderedPrompt {
  model: string;
  parameters: GenerationParameters;
  messages: PromptMessage[];
  image?: ProviderImagePayload;
}

export interface ProviderImagePayload {
  dataUrl: string;
  mimeType: string;
  base64: string;
}

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface DictionaryEntry {
  id: string;
  term: string;
  sourceText: string;
  explanation: string;
  createdAt: string;
}

export interface ExtensionState {
  providerConfigs: ProviderConfig[];
  promptProfiles: PromptProfile[];
  activeProfileByPurpose: Record<ProfilePurpose, string>;
  dictionaryEntries: DictionaryEntry[];
  selectionModeEnabled: boolean;
  selectionResultDisplayMode: SelectionResultDisplayMode;
}

export type BackgroundRequest =
  | { type: "translatePage"; texts: string[] }
  | { type: "translateSelection"; text: string }
  | { type: "translateImage"; imageUrl: string }
  | { type: "generateDictionaryEntry"; term: string; sourceText: string; translationContext?: string }
  | { type: "saveDictionaryEntry"; entry: DictionaryEntry }
  | { type: "deleteDictionaryEntry"; id: string }
  | { type: "restorePage" }
  | { type: "getState" }
  | { type: "saveState"; state: ExtensionState };

export type BackgroundResponse =
  | { ok: true; text?: string; texts?: string[]; state?: ExtensionState }
  | { ok: false; error: string };
