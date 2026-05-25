import { describe, expect, test, vi } from "vitest";
import { mountDictionaryApp } from "../src/dictionaryDom";
import type { DictionaryEntry } from "../src/shared/types";

describe("dictionary page DOM", () => {
  test("groups entries by local date with newest date first", () => {
    const root = document.createElement("div");
    mountDictionaryApp(root, [
      entry("old", "old explanation", "old source", "2026-05-24T12:00:00.000Z"),
      entry("new", "new explanation", "new source", "2026-05-25T12:00:00.000Z")
    ], { onDelete: async () => [] });

    const groups = Array.from(root.querySelectorAll<HTMLElement>("[data-role='dictionary-date-group']"));

    expect(groups).toHaveLength(2);
    expect(groups[0].dataset.dateKey).toBe("2026-05-25");
    expect(groups[0].textContent).toContain("new");
    expect(groups[1].dataset.dateKey).toBe("2026-05-24");
    expect(groups[1].textContent).toContain("old");
  });

  test("collapses explanations to a two line preview and preserves line breaks when expanded", () => {
    const root = document.createElement("div");
    mountDictionaryApp(root, [
      entry("term", "첫 줄\n둘째 줄\n셋째 줄", "source\ncontext", "2026-05-25T12:00:00.000Z")
    ], { onDelete: async () => [] });

    const explanation = root.querySelector<HTMLElement>("[data-role='dictionary-explanation']");
    expect(explanation?.dataset.expanded).toBe("false");
    expect(explanation?.classList.contains("collapsed")).toBe(true);

    root.querySelector<HTMLButtonElement>("[data-action='toggle-dictionary-entry']")?.click();

    const expandedExplanation = root.querySelector<HTMLElement>("[data-role='dictionary-explanation']");
    expect(expandedExplanation?.dataset.expanded).toBe("true");
    expect(expandedExplanation?.style.whiteSpace).toBe("pre-wrap");
    expect(expandedExplanation?.textContent).toBe("첫 줄\n둘째 줄\n셋째 줄");
    expect(root.querySelector<HTMLElement>("[data-role='dictionary-source']")?.style.whiteSpace).toBe("pre-wrap");
  });

  test("searches term, explanation, and source context case-insensitively", () => {
    const root = document.createElement("div");
    mountDictionaryApp(root, [
      entry("Alpha", "first explanation", "source text", "2026-05-25T12:00:00.000Z"),
      entry("Beta", "contains Needle", "source text", "2026-05-25T11:00:00.000Z"),
      entry("Gamma", "third explanation", "context has haystack", "2026-05-25T10:00:00.000Z")
    ], { onDelete: async () => [] });

    const search = root.querySelector<HTMLInputElement>("[data-role='dictionary-search']");
    expect(search).toBeDefined();

    search!.value = "needle";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.textContent).toContain("Beta");
    expect(root.textContent).not.toContain("Alpha");

    search!.value = "HAYSTACK";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.textContent).toContain("Gamma");
    expect(root.textContent).not.toContain("Beta");
  });

  test("shows an empty search state when there are no matches", () => {
    const root = document.createElement("div");
    mountDictionaryApp(root, [entry("Alpha", "first explanation", "source text", "2026-05-25T12:00:00.000Z")], {
      onDelete: async () => []
    });

    const search = root.querySelector<HTMLInputElement>("[data-role='dictionary-search']");
    search!.value = "missing";
    search!.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.textContent).toContain("검색 결과가 없습니다.");
  });

  test("deletes entries through the callback and rerenders the list", async () => {
    const root = document.createElement("div");
    const onDelete = vi.fn(async () => [entry("remaining", "explanation", "source", "2026-05-25T12:00:00.000Z")]);
    mountDictionaryApp(root, [
      entry("delete-me", "explanation", "source", "2026-05-25T13:00:00.000Z"),
      entry("remaining", "explanation", "source", "2026-05-25T12:00:00.000Z")
    ], { onDelete });

    root.querySelector<HTMLButtonElement>("[data-action='delete-dictionary-entry']")?.click();
    await Promise.resolve();

    expect(onDelete).toHaveBeenCalledWith("delete-me");
    expect(root.textContent).not.toContain("delete-me");
    expect(root.textContent).toContain("remaining");
  });
});

function entry(term: string, explanation: string, sourceText: string, createdAt: string): DictionaryEntry {
  return {
    id: term,
    term,
    explanation,
    sourceText,
    createdAt
  };
}
