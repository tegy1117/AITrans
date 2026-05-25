import { describe, expect, test } from "vitest";
import { renderPrompt } from "../src/shared/prompt";
import { createDefaultState, normalizeState } from "../src/shared/storage";

describe("dictionary workflow state and prompt", () => {
  test("renders dictionary prompt with selected term, source context, and translation context", () => {
    const state = createDefaultState();
    const profile = state.promptProfiles.find((candidate) => candidate.purpose === "dictionary");

    expect(profile).toBeDefined();
    const rendered = renderPrompt(profile!, {
      content: "This is a test sentence.",
      dictContent: "test",
      translationContext: "원문:\nThis is a test sentence.\n\n번역문:\n이것은 테스트 문장입니다."
    });

    const promptText = rendered.messages.map((message) => message.content).join("\n");
    expect(promptText).toContain("test");
    expect(promptText).toContain("This is a test sentence.");
    expect(promptText).toContain("이것은 테스트 문장입니다.");
    expect(promptText).not.toContain("{{dict content}}");
    expect(promptText).not.toContain("{{content}}");
    expect(promptText).not.toContain("{{translation context}}");
  });

  test("preserves saved dictionary entries during normalization", () => {
    const state = normalizeState({
      dictionaryEntries: [
        {
          id: "dict-1",
          term: "test",
          sourceText: "This is a test sentence.",
          explanation: "테스트: 어떤 동작이 올바른지 확인하기 위한 절차 또는 예시.",
          createdAt: "2026-05-25T00:00:00.000Z"
        }
      ]
    });

    expect(state.dictionaryEntries).toEqual([
      {
        id: "dict-1",
        term: "test",
        sourceText: "This is a test sentence.",
        explanation: "테스트: 어떤 동작이 올바른지 확인하기 위한 절차 또는 예시.",
        createdAt: "2026-05-25T00:00:00.000Z"
      }
    ]);
  });
});
