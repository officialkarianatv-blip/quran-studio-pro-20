/**
 * Canvas-based Text Measurement Utilities
 * ----------------------------------------
 * Replaces DOM-span-based measurement (Layout Thrashing) with
 * OffscreenCanvas.measureText() which is hundreds of times faster
 * and does not require DOM access or force browser layout.
 *
 * Font must be loaded (via document.fonts.load or FontFace API) before
 * calling these functions for accurate results.
 *
 * SSR NOTE: This module is imported at module-level by pages.ts which runs
 * during TanStack Start SSR in Node.js. All functions guard against the
 * absence of browser globals (OffscreenCanvas, document) and return
 * heuristic estimates when running server-side.
 */

import { splitArabicWords } from "./wordSplit";

/** One OffscreenCanvas + 2D context per font key, reused across calls. */
const _ctxCache = new Map<string, OffscreenCanvasRenderingContext2D>();

/** Returns true when running in a Node.js / SSR environment. */
const _isSSR = typeof document === "undefined";

function getCtx(fontFamily: string, fontSize: number): OffscreenCanvasRenderingContext2D {
  const key = `${fontSize}|${fontFamily}`;
  let ctx = _ctxCache.get(key);
  if (!ctx) {
    const oc = new OffscreenCanvas(1, 1);
    const c2d = oc.getContext("2d");
    if (!c2d) throw new Error("OffscreenCanvas 2d context unavailable");
    c2d.font = `${fontSize}px ${fontFamily}`;
    ctx = c2d;
    _ctxCache.set(key, ctx);
  }
  return ctx;
}

/**
 * Heuristic text width estimate used during SSR where no canvas is available.
 * Arabic characters average ~0.55× fontSize; Bangla ~0.5×.
 * The client will re-measure accurately after hydration.
 */
function ssrEstimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

/**
 * Measures the rendered pixel width of `text` using Canvas API.
 * This is the drop-in replacement for DOM-span-based measureTextWidth().
 *
 * Performance: ~0.001ms per call vs ~0.5–2ms for DOM offsetWidth.
 * SSR: returns a heuristic estimate when document/OffscreenCanvas unavailable.
 */
export function measureTextWidthCanvas(
  text: string,
  fontFamily: string,
  fontSize: number,
): number {
  if (!text) return 0;

  // SSR guard: In Node.js (TanStack Start SSR), neither OffscreenCanvas nor
  // document is available. Return heuristic so page-building proceeds;
  // the client will re-measure accurately after hydration.
  if (_isSSR) {
    return ssrEstimateWidth(text, fontSize);
  }

  // Fallback to DOM measurement if OffscreenCanvas is not available
  // (old browsers). Should not happen in modern Chrome/Firefox.
  if (typeof OffscreenCanvas === "undefined") {
    return measureTextWidthDOM(text, fontFamily, fontSize);
  }

  const ctx = getCtx(fontFamily, fontSize);
  return ctx.measureText(text).width;
}

/**
 * Splits `text` into { fits, overflow } based on available `maxWidth`.
 * Uses Canvas measurement — no DOM reads.
 */
export function splitToFitCanvas(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
): { fits: string; overflow: string } {
  if (!text.trim()) return { fits: text, overflow: "" };

  if (measureTextWidthCanvas(text, fontFamily, fontSize) <= maxWidth) {
    return { fits: text, overflow: "" };
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    // Single word that doesn't fit — keep it anyway (no split possible)
    return { fits: text, overflow: "" };
  }

  let fits = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = fits ? fits + " " + words[i] : words[i]!;
    if (measureTextWidthCanvas(candidate, fontFamily, fontSize) <= maxWidth) {
      fits = candidate;
    } else {
      return {
        fits,
        overflow: words.slice(i).join(" "),
      };
    }
  }

  return { fits: text, overflow: "" };
}

/**
 * Layer-aware splitter. For "arabic", uses surface-word tokenisation
 * (splitArabicWords) and a cumulative canvas-width walk. For any other
 * layer, falls back to splitToFitCanvas (whitespace tokens).
 *
 * A single token that is wider than maxWidth is kept whole (no glyph break).
 */
export function splitToFitForLayer(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
  layer: "arabic" | "bangla",
): { fits: string; overflow: string } {
  if (!text.trim()) return { fits: text, overflow: "" };
  if (layer !== "arabic") {
    return splitToFitCanvas(text, maxWidth, fontFamily, fontSize);
  }

  // Arabic path — splitArabicWords is whitespace-based today, but kept as
  // a named seam so future Arabic-specific tokenisation slots in cleanly.
  const words = splitArabicWords(text);

  if (words.length === 0) return { fits: text, overflow: "" };
  if (words.length === 1) {
    // Single token — keep whole (oversize words don't glyph-break).
    return { fits: text, overflow: "" };
  }

  if (measureTextWidthCanvas(text, fontFamily, fontSize) <= maxWidth) {
    return { fits: text, overflow: "" };
  }

  let fits = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = fits ? fits + " " + words[i] : words[i]!;
    if (measureTextWidthCanvas(candidate, fontFamily, fontSize) <= maxWidth) {
      fits = candidate;
    } else {
      if (fits === "") {
        // First word already overflows — keep it whole.
        return { fits: words[i]!, overflow: words.slice(i + 1).join(" ") };
      }
      return { fits, overflow: words.slice(i).join(" ") };
    }
  }
  return { fits: text, overflow: "" };
}

/**
 * Invalidate all cached contexts (call after font size or family changes
 * that are not captured in the key, e.g. font-variant-numeric).
 */
export function invalidateCanvasMeasureCache(): void {
  _ctxCache.clear();
}

// ─── DOM fallback (used only when OffscreenCanvas is unavailable) ─────────────
// Only available in browser context — never called during SSR.
let _measureSpan: HTMLSpanElement | null = null;

function getMeasureSpan(): HTMLSpanElement {
  // This should never be reached during SSR because measureTextWidthCanvas
  // returns early via the _isSSR guard above.
  if (typeof document === "undefined") {
    throw new Error("getMeasureSpan called in SSR context — this is a bug");
  }
  if (!_measureSpan || !document.body.contains(_measureSpan)) {
    _measureSpan = document.createElement("span");
    _measureSpan.style.cssText = [
      "position:absolute",
      "visibility:hidden",
      "white-space:nowrap",
      "pointer-events:none",
      "top:-9999px",
      "left:-9999px",
    ].join(";");
    document.body.appendChild(_measureSpan);
  }
  return _measureSpan;
}

function measureTextWidthDOM(text: string, fontFamily: string, fontSize: number): number {
  if (typeof document === "undefined") return ssrEstimateWidth(text, fontSize);
  const span = getMeasureSpan();
  span.style.fontFamily = fontFamily;
  span.style.fontSize = `${fontSize}px`;
  span.textContent = text;
  return span.offsetWidth;
}
