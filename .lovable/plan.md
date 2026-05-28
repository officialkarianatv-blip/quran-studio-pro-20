## STEP 6 — `calculateAreaTextHeight` helper

### লক্ষ্য
একটি pure helper যোগ করো যা text + width + font + leading + (optional explicit line breaks) input নিয়ে wrap-simulation চালিয়ে rendered পিক্সেল উচ্চতা return করে। STEP 7-এর "Auto-fit Frame Height" button এটা ব্যবহার করবে। ভবিষ্যতে FabricLines Area-mode auto-height-এও কাজে আসবে।

### পরিবর্তন — নতুন ফাইল `src/lib/areaTextHeight.ts`

```typescript
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
 *   3. height = lineCount × Math.max(1, leading) × fontSize  + paddingY
 *
 * The caller should pass the same `availableWidth`, `fontFamily`, `fontSize`,
 * and `leading` used by the render layer (see FabricLines.tsx Arabic/Bangla
 * style blocks).
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
    layer === "arabic" ? splitArabicWords(paragraph) : paragraph.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 1;
  // Single-word oversize: still one line (no glyph break).
  if (words.length === 1) return 1;

  let lineCount = 1;
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = current ? current + " " + words[i] : words[i]!;
    if (measureTextWidthCanvas(candidate, fontFamily, fontSize) <= availableWidth) {
      current = candidate;
    } else {
      if (current === "") {
        // first word overflows alone — still counts as one line, keep going
        current = "";
        lineCount += 1; // current word placed on its own line
        // place current token as its own line
      } else {
        lineCount += 1;
        current = words[i]!;
      }
    }
  }
  return lineCount;
}

export function calculateAreaTextHeight(opts: CalculateAreaTextHeightOptions): number {
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

  if (availableWidth <= 0 || fontSize <= 0) return Math.max(minHeight, fontSize);

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
```

### সিদ্ধান্ত

- Pure function — কোনো DOM ref, store read, বা React lifecycle নেই।
- `availableWidth` সরাসরি render-time inner-width (FabricLines-এ `width - 16`); caller responsibility।
- `leading` — fallback `1` (matches FabricLines `aLineHeight = Math.max(1, aLeading * aScaleFactor)` semantics with scaleFactor=1; STEP 7 caller scaleFactor consider করবে if needed)।
- `paddingY = 2` ম্যাচ করে FabricLines Bangla `paddingTop: 1` + estimated bottom margin; default conservative।
- Arabic vs Bangla tokeniser switch — STEP 7 Auto-fit button arabic হলে `layer: "arabic"` পাস করবে।
- SSR-safe — `measureTextWidthCanvas` ইতিমধ্যে SSR-guarded।

### যা পরিবর্তন হবে না

- `canvasMeasure.ts` (নতুন helper alone, পুরাতন exports অপরিবর্তিত)
- FabricLines render layers (STEP 2)
- reflow engine (STEP 5)
- কোনো UI

### Verification

- Build পাস হবে (নতুন file, কোনো existing import touch নয়)।
- Manual: `calculateAreaTextHeight({ text: "hello world foo bar", availableWidth: 50, fontFamily: "sans-serif", fontSize: 16, leading: 1.2 })` → কয়েকটি line এর শোধিত height return করবে।

### STEP 7 প্রিভিউ

PropertiesPanel CharacterPanel-এ "Auto-fit Frame Height" button যোগ করা — Area mode UI block-এ। Click করলে current row-এর effective text, font, leading, width নিয়ে `calculateAreaTextHeight` কল করে `patchLocal(selKey, { areaHeight })` সেট করবে।
