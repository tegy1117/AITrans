import type { ProfilePurpose, PromptMessage } from "../shared/types";

export function validatePromptMessages(purpose: ProfilePurpose, messages: PromptMessage[]): string | null {
  const combinedPrompt = messages.map((message) => message.content).join("\n");
  const required = purpose === "dictionary" || purpose === "dictionary-source" ? "{{dict content}}" : "{{content}}";
  if (!combinedPrompt.includes(required)) return `${purposeLabel(purpose)} 프롬프트에는 ${required}가 반드시 포함되어야 합니다.`;
  return null;
}

function purposeLabel(purpose: ProfilePurpose): string {
  if (purpose === "page") return "페이지 번역";
  if (purpose === "selection") return "선택 영역 번역";
  if (purpose === "general") return "일반 번역";
  if (purpose === "youtube-caption") return "유튜브 자막";
  if (purpose === "image") return "이미지 번역";
  if (purpose === "dictionary-source") return "원문 사전";
  return "번역문 사전";
}
