import type { YouTubeCaptionPosition, YouTubeCaptionTrack } from "../shared/types";

export interface YouTubeCaptionFragment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface YouTubeCaptionSentence {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface YouTubeCaptionBatch {
  items: YouTubeCaptionSentence[];
  content: string;
}

export interface YouTubeCaptionTranslation {
  id: string;
  text: string;
}

const OVERLAY_ATTR = "data-ai-translator-youtube-caption";
const SENTENCE_END = /[.!?。！？…]["'”’)]?$/;

export function extractCaptionTracksFromDocument(doc: Document = document): YouTubeCaptionTrack[] {
  for (const script of Array.from(doc.scripts)) {
    const text = script.textContent ?? "";
    const response = extractPlayerResponseFromText(text);
    if (response) {
      const tracks = extractCaptionTracksFromPlayerResponse(response);
      if (tracks.length > 0) return tracks;
    }
  }
  return [];
}

export async function fetchCaptionTracksFromWatchPage(url: string, fetchFn: typeof fetch = fetch): Promise<YouTubeCaptionTrack[]> {
  const response = await fetchFn(url, { credentials: "include" });
  if (!response.ok) throw new Error(`자막 스크립트를 가져올 수 없습니다. HTTP ${response.status}`);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return extractCaptionTracksFromDocument(doc);
}

export function extractCaptionTracksFromPlayerResponse(playerResponse: unknown): YouTubeCaptionTrack[] {
  const rawTracks = getPath(playerResponse, ["captions", "playerCaptionsTracklistRenderer", "captionTracks"]);
  if (!Array.isArray(rawTracks)) return [];

  return rawTracks
    .map((track, index) => toCaptionTrack(track, index))
    .filter((track): track is YouTubeCaptionTrack => Boolean(track))
    .sort(compareCaptionTracks);
}

export async function fetchCaptionFragments(track: YouTubeCaptionTrack, fetchFn: typeof fetch = fetch): Promise<YouTubeCaptionFragment[]> {
  const response = await fetchFn(track.baseUrl);
  if (!response.ok) throw new Error(`자막 스크립트를 가져올 수 없습니다. HTTP ${response.status}`);
  return parseCaptionResponse(await response.text(), response.headers.get("content-type") ?? "");
}

export function parseCaptionResponse(text: string, contentType = ""): YouTubeCaptionFragment[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (contentType.includes("json") || trimmed.startsWith("{")) return parseJson3CaptionResponse(trimmed);
  return parseXmlCaptionResponse(trimmed);
}

export function mergeCaptionFragmentsIntoSentences(fragments: YouTubeCaptionFragment[]): YouTubeCaptionSentence[] {
  const sentences: YouTubeCaptionSentence[] = [];
  let currentText = "";
  let startMs: number | null = null;
  let endMs = 0;

  for (const fragment of fragments) {
    const text = normalizeWhitespace(fragment.text);
    if (!text) continue;
    if (startMs === null) startMs = fragment.startMs;
    currentText = normalizeWhitespace(`${currentText} ${text}`);
    endMs = fragment.endMs;

    if (SENTENCE_END.test(currentText) || currentText.length >= 180) {
      sentences.push(createSentence(sentences.length + 1, currentText, startMs, endMs));
      currentText = "";
      startMs = null;
    }
  }

  if (currentText && startMs !== null) {
    sentences.push(createSentence(sentences.length + 1, currentText, startMs, endMs));
  }

  return sentences;
}

export function createNumberedCaptionBatches(sentences: YouTubeCaptionSentence[], maxChars = 6000): YouTubeCaptionBatch[] {
  const batches: YouTubeCaptionBatch[] = [];
  let current: YouTubeCaptionSentence[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const line = `${current.length + 1}. ${sentence.text}`;
    if (current.length > 0 && currentLength + line.length + 1 > maxChars) {
      batches.push(toBatch(current));
      current = [];
      currentLength = 0;
    }
    current.push(sentence);
    currentLength += line.length + 1;
  }

  if (current.length > 0) batches.push(toBatch(current));
  return batches;
}

export function parseNumberedCaptionResponse(text: string, batch: YouTubeCaptionBatch | undefined): YouTubeCaptionTranslation[] {
  if (!batch) return [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return batch.items.map((item, index) => {
    const line = lines.find((candidate) => parseLineNumber(candidate) === index + 1) ?? lines[index] ?? "";
    return {
      id: item.id,
      text: stripLineNumber(line).trim()
    };
  });
}

export function renderYouTubeCaptionOverlay(player: HTMLElement, position: YouTubeCaptionPosition, text: string): HTMLElement {
  const existing = player.querySelector<HTMLElement>(`[${OVERLAY_ATTR}]`);
  const overlay = existing ?? document.createElement("div");
  overlay.setAttribute(OVERLAY_ATTR, "true");
  overlay.dataset.aiTranslatorYoutubeCaption = "true";
  overlay.dataset.position = position;
  overlay.textContent = text;
  applyOverlayStyle(overlay, position);
  if (!existing) player.append(overlay);
  return overlay;
}

export function removeYouTubeCaptionOverlay(root: ParentNode = document): void {
  root.querySelector(`[${OVERLAY_ATTR}]`)?.remove();
}

export function findYouTubePlayerRoot(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>("#movie_player, .html5-video-player");
}

export function findYouTubeVideo(doc: Document = document): HTMLVideoElement | null {
  return doc.querySelector<HTMLVideoElement>("video");
}

function parseJson3CaptionResponse(text: string): YouTubeCaptionFragment[] {
  const value = JSON.parse(text) as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };
  return (value.events ?? [])
    .map((event) => {
      const captionText = normalizeWhitespace((event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""));
      if (!captionText) return null;
      const startMs = Number(event.tStartMs ?? 0);
      const durationMs = Number(event.dDurationMs ?? 0);
      return {
        text: captionText,
        startMs,
        endMs: startMs + durationMs
      };
    })
    .filter((fragment): fragment is YouTubeCaptionFragment => Boolean(fragment));
}

function parseXmlCaptionResponse(text: string): YouTubeCaptionFragment[] {
  const xml = new DOMParser().parseFromString(text, "text/xml");
  return Array.from(xml.querySelectorAll("text"))
    .map((node) => {
      const startMs = Math.round(Number(node.getAttribute("start") ?? 0) * 1000);
      const durationMs = Math.round(Number(node.getAttribute("dur") ?? 0) * 1000);
      const captionText = normalizeWhitespace(node.textContent ?? "");
      if (!captionText) return null;
      return {
        text: captionText,
        startMs,
        endMs: startMs + durationMs
      };
    })
    .filter((fragment): fragment is YouTubeCaptionFragment => Boolean(fragment));
}

function extractPlayerResponseFromText(text: string): unknown {
  const marker = "ytInitialPlayerResponse";
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return null;
  const firstBrace = text.indexOf("{", markerIndex);
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(text.slice(firstBrace, index + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function toCaptionTrack(track: unknown, index: number): YouTubeCaptionTrack | null {
  if (!track || typeof track !== "object") return null;
  const candidate = track as Record<string, unknown>;
  const baseUrl = typeof candidate.baseUrl === "string" ? candidate.baseUrl : "";
  const languageCode = typeof candidate.languageCode === "string" ? candidate.languageCode : "";
  if (!baseUrl || !languageCode) return null;
  return {
    id: `${languageCode}-${index}-${hashString(baseUrl)}`,
    name: captionTrackName(candidate) || languageCode,
    languageCode,
    baseUrl,
    isAutoGenerated: candidate.kind === "asr"
  };
}

function captionTrackName(track: Record<string, unknown>): string {
  const name = track.name;
  const simpleText = getPath(name, ["simpleText"]);
  if (typeof simpleText === "string") return simpleText;
  const runs = getPath(name, ["runs"]);
  if (Array.isArray(runs)) {
    return runs.map((run) => getPath(run, ["text"])).filter((text): text is string => typeof text === "string").join("");
  }
  return "";
}

function compareCaptionTracks(left: YouTubeCaptionTrack, right: YouTubeCaptionTrack): number {
  const leftEnglish = isEnglishTrack(left);
  const rightEnglish = isEnglishTrack(right);
  if (leftEnglish !== rightEnglish) return leftEnglish ? -1 : 1;
  return left.name.localeCompare(right.name);
}

function isEnglishTrack(track: YouTubeCaptionTrack): boolean {
  return track.languageCode.toLowerCase().startsWith("en") || /english/i.test(track.name);
}

function toBatch(items: YouTubeCaptionSentence[]): YouTubeCaptionBatch {
  return {
    items,
    content: items.map((item, index) => `${index + 1}. ${item.text}`).join("\n")
  };
}

function parseLineNumber(line: string): number | null {
  const match = line.match(/^\s*(?:\[)?(\d+)(?:[\].):)]|\s+-)\s*/);
  return match ? Number(match[1]) : null;
}

function stripLineNumber(line: string): string {
  return line.replace(/^\s*(?:\[)?\d+(?:[\].):)]|\s+-)\s*/, "");
}

function createSentence(index: number, text: string, startMs: number, endMs: number): YouTubeCaptionSentence {
  return {
    id: `caption-${index}`,
    text: normalizeWhitespace(text),
    startMs,
    endMs
  };
}

function applyOverlayStyle(overlay: HTMLElement, position: YouTubeCaptionPosition): void {
  Object.assign(overlay.style, {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: position === "below" ? "8%" : "18%",
    zIndex: "2147483647",
    maxWidth: "86%",
    padding: "5px 10px",
    borderRadius: "6px",
    color: "#ffffff",
    background: "rgba(0, 0, 0, 0.74)",
    font: "600 18px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    textAlign: "center",
    whiteSpace: "pre-wrap",
    pointerEvents: "none",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)"
  });
}

function normalizeWhitespace(text: string): string {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function getPath(value: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, value);
}
