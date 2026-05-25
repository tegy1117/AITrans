import { describe, expect, test } from "vitest";
import { getSelectionAnchor, rememberSelectionAnchor } from "../src/content/selectionContext";

describe("selection context", () => {
  test("remembers the selected range anchor for later context menu actions", () => {
    const range = document.createRange();
    const paragraph = document.createElement("p");
    paragraph.textContent = "Hello world";
    document.body.append(paragraph);
    range.selectNodeContents(paragraph);

    const rect = new DOMRect(10, 20, 120, 30);
    range.getBoundingClientRect = () => rect;

    rememberSelectionAnchor({
      toString: () => "Hello world",
      rangeCount: 1,
      getRangeAt: () => range
    } as unknown as Selection);

    expect(getSelectionAnchor()).toBe(rect);
  });

  test("falls back to a visible default anchor when the selection is unavailable", () => {
    expect(getSelectionAnchor()).toEqual(new DOMRect(16, 16, 0, 0));
  });
});
