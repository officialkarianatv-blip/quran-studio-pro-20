/**
 * areaTextHeight.ts
 * ─────────────────
 * Pure simulation: given a paragraph of text and a frame width, compute the
 * pixel height the contenteditable Area frame would render at.
 *
 * Uses Canvas measurement (no DOM reads, no layout thrash). Mirrors the
 * wrap rules used by `splitToFitForLayer` for parity with the editor.
 *
 * Algorithm:
 *   1. Split `text` on explicit "\n" first (Enter-inserted line breaks).
 *   2. For each paragraph, run a greedy word-wrap using
 *      `measureTextWidthCanvas` and accumulate the visual line count.
 *   3. height = lineCount × Math.max(1, leading) × fontSize + paddingY
 */

import { measureTextWidthCanvas } from "./canvasMeasure";
import { splitArabicWords } from "./wordSplit";

export type CalculateAreaTextHeightOptions = {
  text: string;
  /** Inner width available for wrap (already excludes horizontal padding). */
  availableWidth: number;
  fontFamily: string;
  fontSize: number;
  /** Leading multiplier (e.g. 1, 1.1, 1.2). Falls back to 1 if 0/undefined. */
  leading?: number;
  /** "arabic" uses Arabic-aware tokeniser; otherwise whitespace split. */
  layer?: "arabic" | "bangla";
  /** Extra vertical padding to add (top + bottom). Default 2. */
  paddingY?: number;
  /** Minimum height in px. Default 0. */
  minHeight?: number;
};

function countWrappedLinesForParagraph(
  paragraph: string,
  availableWidth: number,
  fontFamily: string,
  fontSize: number,
  layer: "arabic" | "bangla",
): number {
  if (!paragraph.trim()) return 1; // blank line still occupies one row

  const words =
    layer === "arabic"
      ? splitArabicWords(paragraph)
      : paragraph.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 1;
  if (words.length === 1) return 1; // single oversize token — no glyph break

  let lineCount = 1;
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = current ? current + " " + words[i] : words[i]!;
    if (measureTextWidthCanvas(candidate, fontFamily, fontSize) <= availableWidth) {
      current = candidate;
    } else {
      if (current === "") {
        // First word already overflows — keep it on its own line.
        lineCount += 1;
        current = "";
      } else {
        lineCount += 1;
        current = words[i]!;
      }
    }
  }
  return lineCount;
}

export function calculateAreaTextHeight(
  opts: CalculateAreaTextHeightOptions,
): number {
  const {
    text,
    availableWidth,
    fontFamily,
    fontSize,
    leading,
    layer = "bangla",
    paddingY = 2,
    minHeight = 0,
  } = opts;

  if (availableWidth <= 0 || fontSize <= 0) {
    return Math.max(minHeight, fontSize);
  }

  const lh = Math.max(1, leading || 1);
  const lineHeightPx = fontSize * lh;

  const paragraphs = (text ?? "").split("\n");
  let totalLines = 0;
  for (const p of paragraphs) {
    totalLines += countWrappedLinesForParagraph(
      p,
      availableWidth,
      fontFamily,
      fontSize,
      layer,
    );
  }
  if (totalLines === 0) totalLines = 1;

  return Math.max(minHeight, Math.ceil(totalLines * lineHeightPx + paddingY));
}
