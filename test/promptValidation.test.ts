import { describe, expect, test } from "vitest";
import { validatePromptMessages } from "../src/options/promptValidation";

describe("prompt validation", () => {
  test("requires content placeholder for translation profiles", () => {
    expect(validatePromptMessages("page", [{ role: "user", content: "Translate {{content}}" }])).toBeNull();
    expect(validatePromptMessages("selection", [{ role: "user", content: "Translate this" }])).toContain("{{content}}");
    expect(validatePromptMessages("image", [{ role: "user", content: "OCR {{content}}" }])).toBeNull();
  });

  test("requires dict content placeholder for dictionary profiles", () => {
    expect(validatePromptMessages("dictionary", [{ role: "user", content: "Explain {{dict content}}" }])).toBeNull();
    expect(validatePromptMessages("dictionary", [{ role: "user", content: "Explain {{content}}" }])).toContain(
      "{{dict content}}"
    );
  });
});
