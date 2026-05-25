import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Korean UI localization", () => {
  test("popup and options pages use Korean product-facing copy", () => {
    expect(readFileSync("popup.html", "utf8")).toContain("AI 번역기");
    expect(readFileSync("options.html", "utf8")).toContain("AI 번역기 설정");
  });

  test("manifest and context menu expose Korean descriptions", () => {
    expect(readFileSync("public/manifest.json", "utf8")).toContain("AI 번역 확장 프로그램");
    expect(readFileSync("src/background/contextMenus.ts", "utf8")).toContain("선택한 텍스트 AI로 번역");
    expect(readFileSync("src/background/contextMenus.ts", "utf8")).toContain("이미지 AI로 번역");
  });

  test("tutorial page explains content placeholders in Korean", () => {
    const tutorial = readFileSync("tutorial.html", "utf8");

    expect(tutorial).toContain("{{content}}");
    expect(tutorial).toContain("{{dict content}}");
    expect(tutorial).toContain("{{translation context}}");
    expect(tutorial).toContain("프롬프트 안에서 AI에게 보낼 원문이 들어가는 자리");
  });

  test("default image prompt describes attached image translation", () => {
    expect(readFileSync("src/shared/storage.ts", "utf8")).toContain("첨부된 이미지에서 읽을 수 있는 텍스트");
  });

  test("source files do not contain broken Korean mojibake markers", () => {
    const text = [
      readFileSync("src/shared/storage.ts", "utf8"),
      readFileSync("src/popup.ts", "utf8"),
      readFileSync("src/content/selectionBubble.ts", "utf8"),
      readFileSync("README.md", "utf8")
    ].join("\n");

    expect(text).not.toContain("踰덉");
    expect(text).not.toContain("?섏");
    expect(text).not.toContain("�");
  });
});
