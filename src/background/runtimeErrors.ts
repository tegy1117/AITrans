const MISSING_RECEIVER_MESSAGE = "Could not establish connection. Receiving end does not exist.";

interface RuntimeErrorTarget {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export function installBackgroundRuntimeErrorGuard(target: RuntimeErrorTarget = globalThis): void {
  target.addEventListener("unhandledrejection", (event) => {
    const rejection = event as PromiseRejectionEvent;
    if (isMissingReceiverRejection(rejection.reason)) {
      rejection.preventDefault();
    }
  });
}

export function isMissingReceiverRejection(reason: unknown): boolean {
  if (reason instanceof Error) return reason.message.includes(MISSING_RECEIVER_MESSAGE);
  if (typeof reason === "string") return reason.includes(MISSING_RECEIVER_MESSAGE);
  return false;
}
