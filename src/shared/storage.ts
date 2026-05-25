import type { ExtensionState, ProfilePurpose, PromptProfile } from "./types";

export const STORAGE_KEY = "aiTranslationExtensionState";

const PURPOSES: ProfilePurpose[] = ["page", "selection", "image", "dictionary", "dictionary-source", "general", "youtube-caption"];
const MAX_TRANSLATION_HISTORY = 100;

export function createDefaultState(): ExtensionState {
  const promptProfiles = createDefaultPromptProfiles();

  return {
    providerConfigs: [
      {
        id: "ollama-local",
        type: "ollama-local",
        name: "Ollama 로컬",
        baseUrl: "http://localhost:11434"
      }
    ],
    promptProfiles,
    activeProfileByPurpose: Object.fromEntries(
      PURPOSES.map((purpose) => [purpose, promptProfiles.find((profile) => profile.purpose === purpose)?.id ?? ""])
    ) as ExtensionState["activeProfileByPurpose"],
    dictionaryEntries: [],
    translationHistory: [],
    selectionModeEnabled: false,
    selectionResultDisplayMode: "drawer",
    generalTranslatorDisplayMode: "drawer",
    youtubeCaptionPosition: "below"
  };
}

export function normalizeState(input: Partial<ExtensionState> | undefined | null = undefined): ExtensionState {
  const defaults = createDefaultState();
  const promptProfiles = normalizePromptProfiles(input?.promptProfiles, defaults.promptProfiles);
  const requestedActive = {
    ...defaults.activeProfileByPurpose,
    ...input?.activeProfileByPurpose
  };

  return {
    providerConfigs: input?.providerConfigs ?? defaults.providerConfigs,
    promptProfiles,
    activeProfileByPurpose: normalizeActiveProfiles(promptProfiles, requestedActive),
    dictionaryEntries: input?.dictionaryEntries ?? [],
    translationHistory: normalizeTranslationHistory(input?.translationHistory, promptProfiles),
    selectionModeEnabled: input?.selectionModeEnabled ?? false,
    selectionResultDisplayMode: input?.selectionResultDisplayMode === "bubble" ? "bubble" : "drawer",
    generalTranslatorDisplayMode: normalizeGeneralTranslatorDisplayMode(input?.generalTranslatorDisplayMode),
    youtubeCaptionPosition: input?.youtubeCaptionPosition === "above" ? "above" : "below"
  };
}

export function trimTranslationHistory(entries: ExtensionState["translationHistory"]): ExtensionState["translationHistory"] {
  return entries.slice(0, MAX_TRANSLATION_HISTORY);
}

function normalizeTranslationHistory(
  entries: ExtensionState["translationHistory"] | undefined,
  profiles: PromptProfile[]
): ExtensionState["translationHistory"] {
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  return trimTranslationHistory(
    (entries ?? []).map((entry) => ({
      ...entry,
      profileName: entry.profileName ?? profileNames.get(entry.profileId) ?? entry.profileId
    }))
  );
}

function normalizeGeneralTranslatorDisplayMode(value: unknown): ExtensionState["generalTranslatorDisplayMode"] {
  if (value === "tab" || value === "window") return "tab";
  return "drawer";
}

function normalizePromptProfiles(input: PromptProfile[] | undefined, defaults: PromptProfile[]): PromptProfile[] {
  if (!input?.length) return defaults;

  const next = [...input];
  for (const purpose of PURPOSES) {
    if (!next.some((profile) => profile.purpose === purpose)) {
      const fallback = defaults.find((profile) => profile.purpose === purpose);
      if (fallback) next.push(fallback);
    }
  }
  return next;
}

export async function loadState(): Promise<ExtensionState> {
  const value = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(value[STORAGE_KEY] as Partial<ExtensionState> | undefined);
}

export async function saveState(state: ExtensionState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeState(state) });
}

function createDefaultPromptProfiles(): PromptProfile[] {
  return [
    createProfile("page-default", "page", "페이지 번역", "다음 웹페이지 텍스트를 자연스러운 한국어로 번역해줘.\n\n{{content}}"),
    createProfile(
      "selection-default",
      "selection",
      "선택 영역 번역",
      "선택한 텍스트를 자연스러운 한국어로 번역해줘. 답변은 간결하게 유지해줘.\n\n{{content}}"
    ),
    createProfile("image-default", "image", "이미지 번역", "첨부된 이미지에서 읽을 수 있는 텍스트를 한국어로 번역해줘.\n\n추가 지시:\n{{content}}"),
    createProfile(
      "general-default",
      "general",
      "일반 번역",
      "다음 텍스트를 자연스러운 한국어로 번역해줘. 원문의 의미와 어조를 유지해줘.\n\n{{content}}"
    ),
    createProfile(
      "youtube-caption-default",
      "youtube-caption",
      "유튜브 자막 번역",
      "다음 번호가 붙은 유튜브 자막을 자연스러운 한국어로 번역해줘.\n번호와 줄 수를 반드시 유지하고, 각 줄에는 번역문만 써줘.\n\n{{content}}"
    ),
    createProfile(
      "dictionary-default",
      "dictionary",
      "번역문 사전 항목",
      "다음 단어를 한국어 사전 항목으로 설명해줘: {{dict content}}\n\n원문 전체 지문:\n{{content}}\n\n번역문 전체 지문:\n{{translation context}}"
    ),
    createProfile(
      "dictionary-source-default",
      "dictionary-source",
      "원문 사전 항목",
      "다음 원문 단어를 한국어 사전 항목으로 설명해줘: {{dict content}}\n\n원문 전체 지문:\n{{content}}\n\n번역문 전체 지문:\n{{translation context}}"
    )
  ];
}

function createProfile(id: string, purpose: ProfilePurpose, name: string, userPrompt: string): PromptProfile {
  return {
    id,
    purpose,
    name,
    providerId: "ollama-local",
    model: "llama3.2",
    parameters: {
      maxTokens: 2000,
      maxOutputTokens: 1000,
      temperature: 0.2,
      topP: 1,
      reasoningEffort: "low"
    },
    messages: [
      {
        role: "system",
        content: "너는 신중한 번역 도우미야. 가능한 한 의미, 어조, 형식을 유지해줘."
      },
      { role: "user", content: userPrompt }
    ]
  };
}

function normalizeActiveProfiles(
  profiles: PromptProfile[],
  requested: ExtensionState["activeProfileByPurpose"]
): ExtensionState["activeProfileByPurpose"] {
  return Object.fromEntries(
    PURPOSES.map((purpose) => {
      const requestedId = requested[purpose];
      const exists = profiles.some((profile) => profile.id === requestedId && profile.purpose === purpose);
      return [purpose, exists ? requestedId : profiles.find((profile) => profile.purpose === purpose)?.id ?? ""];
    })
  ) as ExtensionState["activeProfileByPurpose"];
}
