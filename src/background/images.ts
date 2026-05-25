import type { ProviderImagePayload } from "../shared/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function fetchImagePayload(
  imageUrl: string,
  fetcher: Fetcher = fetch,
  maxBytes = MAX_IMAGE_BYTES
): Promise<ProviderImagePayload> {
  const response = await fetcher(imageUrl);
  if (!response.ok) {
    throw new Error(`이미지를 가져오지 못했습니다. HTTP ${response.status}`);
  }

  const mimeType = readMimeType(response);
  if (!mimeType.startsWith("image/")) {
    throw new Error("선택한 URL은 이미지 파일이 아닙니다.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new Error(`이미지가 너무 큽니다. ${Math.round(maxBytes / 1024 / 1024)}MB 이하 이미지를 사용해 주세요.`);
  }

  const base64 = bytesToBase64(bytes);
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
    base64
  };
}

function readMimeType(response: Response): string {
  return response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
