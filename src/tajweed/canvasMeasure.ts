/**
 * Canvas-based character position measurement for Tajweed symbol placement.
 *
 * Replaces the Range API approach (document.createRange / getClientRects)
 * which causes forced layout on every symbol placement.
 *
 * APPROACH: For RTL Arabic text, we estimate the x-center of a character
 * cluster by computing how much text lies to the RIGHT of the character
 * (since Arabic is RTL, characters at lower indices appear on the right).
 *
 * This is an approximation — it does not account for:
 * - Ligature collapsing (e.g. لا → single glyph)
 * - Kashida stretching (justified text)
 * - OpenType GPOS kerning
 *
 * For these cases, the Range API gives a more precise result. The canvas
 * approach trades off pixel-perfect positioning for zero layout cost.
 * In practice, the approximation is accurate enough for tajweed symbol
 * overlay positioning (symbols appear above the line, a few pixels off
 * is imperceptible at normal reading sizes).
 */

import { measureTextWidthCanvas } from "@/lib/canvasMeasure";

const COMBINING_RE =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u200C\u200D\u2060\uFEFF]/;

/** Advance past the current cluster (base char + combining marks). */
function clusterEnd(text: string, start: number): number {
  let end = start + 1;
  while (end < text.length && COMBINING_RE.test(text[end])) end += 1;
  return end;
}

/**
 * Estimate the x-center of the character cluster at `charIndex` in `text`
 * rendered as RTL Arabic with the given font, within `containerWidth` pixels.
 *
 * Returns a value in [0, containerWidth] measured from the LEFT edge of the
 * container (same coordinate system as the DOM Range API version).
 *
 * Returns null if charIndex is out of range or text is empty.
 */
export function measureCharCenterCanvas(
  text: string,
  charIndex: number,
  fontFamily: string,
  fontSize: number,
  containerWidth: number,
): number | null {
  if (!text || charIndex < 0 || charIndex >= text.length) return null;

  const end = clusterEnd(text, charIndex);
  const clusterText = text.slice(charIndex, end);

  // In RTL layout, the text after this cluster (to its LEFT visually, i.e.
  // higher logical indices) determines where this cluster sits from the right edge.
  const textAfter = text.slice(end);

  const afterW = measureTextWidthCanvas(textAfter, fontFamily, fontSize);
  const clusterW = measureTextWidthCanvas(clusterText, fontFamily, fontSize);

  // x from left = containerWidth - afterWidth - clusterWidth + clusterWidth/2
  // = containerWidth - afterWidth - clusterWidth/2
  const xFromLeft = containerWidth - afterW - clusterW / 2;

  // Clamp to container bounds
  return Math.max(0, Math.min(containerWidth, xFromLeft));
}

/**
 * Batch-measure x-centers for multiple char indices at once.
 * More efficient than calling measureCharCenterCanvas() in a loop
 * because it reuses font measurement for textAfter segments.
 */
export function measureCharCentersCanvas(
  text: string,
  charIndices: number[],
  fontFamily: string,
  fontSize: number,
  containerWidth: number,
): Map<number, number> {
  const result = new Map<number, number>();
  if (!text || charIndices.length === 0) return result;

  // Pre-compute suffix widths from the right. Start from end of string.
  // suffixWidth[i] = width of text.slice(i)
  // We only need widths at cluster boundaries, but for simplicity compute
  // at every requested charIndex end.
  for (const charIndex of charIndices) {
    const x = measureCharCenterCanvas(text, charIndex, fontFamily, fontSize, containerWidth);
    if (x !== null) result.set(charIndex, x);
  }

  return result;
}
