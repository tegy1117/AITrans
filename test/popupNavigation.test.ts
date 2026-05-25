import { describe, expect, test, vi } from "vitest";
import { openExtensionPageInNewTab } from "../src/popup/navigation";

describe("popup navigation", () => {
  test("opens extension pages in a new tab", () => {
    const create = vi.fn();
    const getURL = vi.fn((path: string) => `chrome-extension://id/${path}`);

    openExtensionPageInNewTab("dictionary.html", {
      runtime: { getURL },
      tabs: { create }
    });

    expect(getURL).toHaveBeenCalledWith("dictionary.html");
    expect(create).toHaveBeenCalledWith({ url: "chrome-extension://id/dictionary.html" });
  });
});
