import { describe, expect, test, vi } from "vitest";
import { installBackgroundRuntimeErrorGuard, isMissingReceiverRejection } from "../src/background/runtimeErrors";

describe("background runtime error guard", () => {
  test("recognizes Chrome missing receiver promise rejections", () => {
    expect(isMissingReceiverRejection(new Error("Could not establish connection. Receiving end does not exist."))).toBe(true);
    expect(isMissingReceiverRejection("Could not establish connection. Receiving end does not exist.")).toBe(true);
    expect(isMissingReceiverRejection(new Error("Provider request failed with HTTP 401"))).toBe(false);
  });

  test("prevents only known missing receiver unhandled rejections", () => {
    const listeners: Array<(event: { reason: unknown; preventDefault(): void }) => void> = [];
    installBackgroundRuntimeErrorGuard({
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "unhandledrejection" && typeof listener === "function") {
          listeners.push(listener as unknown as (event: { reason: unknown; preventDefault(): void }) => void);
        }
      }
    });

    const knownPreventDefault = vi.fn();
    listeners[0]({
      reason: new Error("Could not establish connection. Receiving end does not exist."),
      preventDefault: knownPreventDefault
    });

    const unknownPreventDefault = vi.fn();
    listeners[0]({
      reason: new Error("Provider request failed with HTTP 401"),
      preventDefault: unknownPreventDefault
    });

    expect(knownPreventDefault).toHaveBeenCalledOnce();
    expect(unknownPreventDefault).not.toHaveBeenCalled();
  });
});
