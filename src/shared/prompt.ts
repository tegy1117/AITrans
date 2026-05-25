import type { ProfilePurpose, PromptProfile, RenderedPrompt } from "./types";

const CONTENT_PLACEHOLDER = "{{content}}";
const DICT_PLACEHOLDER = "{{dict content}}";
const TRANSLATION_CONTEXT_PLACEHOLDER = "{{translation context}}";

export interface PromptRenderInput {
  content: string;
  dictContent?: string;
  translationContext?: string;
}

export function renderPrompt(profile: PromptProfile, input: PromptRenderInput): RenderedPrompt {
  assertRequiredPlaceholder(profile);

  return {
    model: profile.model,
    parameters: { ...profile.parameters },
    messages: profile.messages.map((message) => ({
      role: message.role,
      content: message.content
        .replaceAll(CONTENT_PLACEHOLDER, input.content)
        .replaceAll(DICT_PLACEHOLDER, input.dictContent ?? "")
        .replaceAll(TRANSLATION_CONTEXT_PLACEHOLDER, input.translationContext ?? "")
    }))
  };
}

function assertRequiredPlaceholder(profile: PromptProfile): void {
  const combined = profile.messages.map((message) => message.content).join("\n");
  const required = requiredPlaceholderFor(profile.purpose);

  if (!combined.includes(required)) {
    throw new Error(`${profile.name} must include ${required} in at least one prompt message.`);
  }
}

function requiredPlaceholderFor(purpose: ProfilePurpose): string {
  return purpose === "dictionary" || purpose === "dictionary-source" ? DICT_PLACEHOLDER : CONTENT_PLACEHOLDER;
}
