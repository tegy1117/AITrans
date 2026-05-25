import { describe, expect, test } from "vitest";
import { renderPrompt } from "../src/shared/prompt";
import type { PromptProfile } from "../src/shared/types";

const baseProfile: PromptProfile = {
  id: "page-default",
  purpose: "page",
  name: "Page translator",
  providerId: "openai-main",
  model: "gpt-4.1-mini",
  parameters: {
    maxTokens: 2000,
    maxOutputTokens: 1000,
    temperature: 0.2,
    topP: 1,
    reasoningEffort: "low"
  },
  messages: [
    { role: "system", content: "Translate to Korean." },
    { role: "assistant", content: "Ready." },
    { role: "user", content: "Text: {{content}}" }
  ]
};

describe("renderPrompt", () => {
  test("replaces content placeholders without changing message order", () => {
    const rendered = renderPrompt(baseProfile, { content: "Hello world" });

    expect(rendered.messages).toEqual([
      { role: "system", content: "Translate to Korean." },
      { role: "assistant", content: "Ready." },
      { role: "user", content: "Text: Hello world" }
    ]);
  });

  test("rejects page prompts without content placeholder", () => {
    expect(() =>
      renderPrompt({ ...baseProfile, messages: [{ role: "user", content: "Translate this." }] }, { content: "Hello" })
    ).toThrow("{{content}}");
  });

  test("uses dict content placeholder for dictionary profiles", () => {
    const rendered = renderPrompt(
      {
        ...baseProfile,
        id: "dict-default",
        purpose: "dictionary",
        messages: [
          { role: "system", content: "Explain the selected word." },
          { role: "user", content: "Word: {{dict content}}" }
        ]
      },
      { content: "context sentence", dictContent: "serendipity" }
    );

    expect(rendered.messages.at(-1)?.content).toBe("Word: serendipity");
  });

  test("replaces translation context placeholder independently from content", () => {
    const rendered = renderPrompt(
      {
        ...baseProfile,
        id: "dict-context",
        purpose: "dictionary",
        messages: [
          { role: "system", content: "Explain the selected word." },
          { role: "user", content: "Word: {{dict content}}\nSource: {{content}}\nTranslated: {{translation context}}" }
        ]
      },
      {
        content: "Original sentence.",
        dictContent: "term",
        translationContext: "번역된 문장."
      }
    );

    expect(rendered.messages.at(-1)?.content).toBe(
      "Word: term\nSource: Original sentence.\nTranslated: 번역된 문장."
    );
  });
});
