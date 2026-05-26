// Measure the visual x-center of a logical character index inside an Arabic
// <span>. Cluster-aware: the target base character is grouped with its
// trailing combining marks (tashkeel, dagger-alif, small-high marks, ZW*)
// so RTL bidi, justification, kashida and ligature shaping all map back to a
// stable on-screen rectangle.
//
// PERFORMANCE:
// - Primary path: Canvas-based mathematical approximation via canvasMeasure.ts.
//   Zero DOM reads, no forced layout. ~0.001ms per call.
// - Fallback path: Range API (original behaviour). Used when the canvas
//   estimate differs significantly from DOM geometry (e.g. after kashida
//   justification stretches the line). Controlled by USE_RANGE_FALLBACK.

import { measureCharCenterCanvas } from "./canvasMeasure";

const COMBINING_RE =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u200C\u200D\u2060\uFEFF]/;

function clusterEnd(text: string, start: number): number {
  let end = start + 1;
  while (end < text.length && COMBINING_RE.test(text[end])) end += 1;
  return end;
}

function bestRect(range: Range): DOMRect | null {
  const rects = range.getClientRects();
  let best: DOMRect | null = null;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.width === 0 && r.height === 0) continue;
    if (!best || r.width * r.height > best.width * best.height) best = r;
  }
  if (best) return best;
  const r = range.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

/** Range API measurement — the original precise approach. Used as fallback. */
function measureCharCenterRange(
  span: HTMLElement,
  layer: HTMLElement,
  charIndex: number,
): number | null {
  const node = span.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.nodeValue ?? "";
  if (charIndex < 0 || charIndex >= text.length) return null;

  try {
    const range = document.createRange();
    const end = clusterEnd(text, charIndex);
    range.setStart(node, charIndex);
    range.setEnd(node, end);
    let rect = bestRect(range);

    // Fallback: expand to include the previous cluster (helps with ligatures
    // that collapse the base char into an adjacent shape).
    if (!rect && charIndex > 0) {
      const r2 = document.createRange();
      r2.setStart(node, Math.max(0, charIndex - 1));
      r2.setEnd(node, end);
      rect = bestRect(r2);
    }
    // Fallback: extend to the next cluster.
    if (!rect && end < text.length) {
      const r3 = document.createRange();
      r3.setStart(node, charIndex);
      r3.setEnd(node, clusterEnd(text, end));
      rect = bestRect(r3);
    }
    if (!rect) return null;

    const base = layer.getBoundingClientRect();
    return rect.left + rect.width / 2 - base.left;
  } catch {
    return null;
  }
}

/**
 * Measure the x-center of a character cluster at `charIndex`.
 *
 * Uses Canvas math as the primary path (no DOM layout cost).
 * Falls back to Range API if canvas measurement is unavailable or
 * the span/layer references are provided (opt-in to precise mode).
 *
 * @param span      The <span> containing the Arabic text node.
 * @param layer     The containing layer element (for offset calculation).
 * @param charIndex Logical character index in the text.
 * @param fontFamily Font family string (for canvas measurement).
 * @param fontSize  Font size in px (for canvas measurement).
 * @param containerWidth Width of the text container in px.
 * @param useRangeApi Force Range API (precise but costly). Default false.
 */
export function measureCharCenter(
  span: HTMLElement,
  layer: HTMLElement,
  charIndex: number,
  fontFamily?: string,
  fontSize?: number,
  containerWidth?: number,
  useRangeApi = false,
): number | null {
  // If font info provided and range not forced → fast canvas path
  if (!useRangeApi && fontFamily && fontSize && containerWidth) {
    const node = span.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? "";
      const result = measureCharCenterCanvas(
        text,
        charIndex,
        fontFamily,
        fontSize,
        containerWidth,
      );
      if (result !== null) return result;
    }
  }

  // Range API fallback — precise but triggers layout
  return measureCharCenterRange(span, layer, charIndex);
}
