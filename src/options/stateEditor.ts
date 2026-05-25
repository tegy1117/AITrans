import { normalizeState } from "../shared/storage";
import type { ExtensionState, ProfilePurpose, PromptMessage, PromptProfile, ProviderConfig } from "../shared/types";

type NewProvider = ProviderConfig;
type ProviderPatch = Partial<Omit<ProviderConfig, "id">>;
type NewProfile = Pick<PromptProfile, "id" | "purpose" | "name" | "providerId" | "model"> &
  Partial<Pick<PromptProfile, "parameters" | "messages">>;
type ProfilePatch = Partial<Omit<PromptProfile, "id">>;

export function addProvider(state: ExtensionState, provider: NewProvider): ExtensionState {
  if (state.providerConfigs.some((candidate) => candidate.id === provider.id)) {
    throw new Error(`이미 존재하는 프로바이더입니다: ${provider.id}`);
  }

  return normalizeState({
    ...state,
    providerConfigs: [...state.providerConfigs, withProviderDefaults(provider)]
  });
}

export function updateProvider(state: ExtensionState, providerId: string, patch: ProviderPatch): ExtensionState {
  return normalizeState({
    ...state,
    providerConfigs: state.providerConfigs.map((provider) =>
      provider.id === providerId ? withProviderDefaults({ ...provider, ...patch }) : provider
    )
  });
}

export function deleteProvider(state: ExtensionState, providerId: string): ExtensionState {
  if (state.promptProfiles.some((profile) => profile.providerId === providerId)) {
    throw new Error("이 프로바이더를 사용하는 프롬프트 프로필이 있어 삭제할 수 없습니다.");
  }

  return normalizeState({
    ...state,
    providerConfigs: state.providerConfigs.filter((provider) => provider.id !== providerId)
  });
}

export function addProfile(state: ExtensionState, profile: NewProfile): ExtensionState {
  if (state.promptProfiles.some((candidate) => candidate.id === profile.id)) {
    throw new Error(`이미 존재하는 프로필입니다: ${profile.id}`);
  }

  const nextProfile: PromptProfile = {
    parameters: {},
    messages: defaultMessagesFor(profile.purpose),
    ...profile
  };

  return normalizeState({
    ...state,
    promptProfiles: [...state.promptProfiles, nextProfile],
    activeProfileByPurpose: {
      ...state.activeProfileByPurpose,
      [profile.purpose]: state.activeProfileByPurpose[profile.purpose] || profile.id
    }
  });
}

export function updateProfile(state: ExtensionState, profileId: string, patch: ProfilePatch): ExtensionState {
  return normalizeState({
    ...state,
    promptProfiles: state.promptProfiles.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile))
  });
}

export function duplicateProfile(state: ExtensionState, profileId: string, newProfileId: string): ExtensionState {
  const source = findProfile(state, profileId);
  return addProfile(state, {
    ...source,
    id: newProfileId,
    name: `${source.name} 복사본`,
    messages: source.messages.map((message) => ({ ...message })),
    parameters: { ...source.parameters }
  });
}

export function deleteProfile(state: ExtensionState, profileId: string): ExtensionState {
  const profile = findProfile(state, profileId);
  const remaining = state.promptProfiles.filter((candidate) => candidate.id !== profileId);
  const fallback = remaining.find((candidate) => candidate.purpose === profile.purpose)?.id ?? "";
  if (!fallback) throw new Error(`${purposeLabel(profile.purpose)}의 마지막 프로필은 삭제할 수 없습니다.`);

  return normalizeState({
    ...state,
    promptProfiles: remaining,
    activeProfileByPurpose: {
      ...state.activeProfileByPurpose,
      [profile.purpose]: state.activeProfileByPurpose[profile.purpose] === profileId ? fallback : state.activeProfileByPurpose[profile.purpose]
    }
  });
}

export function setActiveProfile(state: ExtensionState, purpose: ProfilePurpose, profileId: string): ExtensionState {
  const profile = findProfile(state, profileId);
  if (profile.purpose !== purpose) {
    throw new Error(`${profileId} 프로필은 ${purposeLabel(purpose)} 프로필이 아닙니다.`);
  }

  return normalizeState({
    ...state,
    activeProfileByPurpose: {
      ...state.activeProfileByPurpose,
      [purpose]: profileId
    }
  });
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function findProfile(state: ExtensionState, profileId: string): PromptProfile {
  const profile = state.promptProfiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`프로필을 찾을 수 없습니다: ${profileId}`);
  return profile;
}

function withProviderDefaults(provider: ProviderConfig): ProviderConfig {
  if (provider.type === "ollama-local" && !provider.baseUrl) {
    return { ...provider, baseUrl: "http://localhost:11434" };
  }
  return provider;
}

function defaultMessagesFor(purpose: ProfilePurpose): PromptMessage[] {
  if (purpose === "dictionary") {
    return [
      {
        role: "user",
        content: "{{dict content}} 단어를 한국어 사전 항목으로 설명해줘.\n\n원문 문맥:\n{{content}}\n\n원문과 번역문:\n{{translation context}}"
      }
    ];
  }
  if (purpose === "image") return [{ role: "user", content: "첨부된 이미지에서 읽을 수 있는 텍스트를 한국어로 번역해줘.\n\n추가 지시:\n{{content}}" }];
  return [{ role: "user", content: "{{content}}" }];
}

function purposeLabel(purpose: ProfilePurpose): string {
  if (purpose === "page") return "페이지 번역";
  if (purpose === "selection") return "선택 영역 번역";
  if (purpose === "image") return "이미지 번역";
  return "사전";
}
