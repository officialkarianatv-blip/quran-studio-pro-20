// Continuous RTL paragraph flow for the Quran stream.
// Arabic and Bangla are packed as two INDEPENDENT streams and zipped per row,
// so a row may contain Arabic only, Bangla only, or both.
//
// PERFORMANCE: Text measurement uses OffscreenCanvas via canvasMeasure.ts
// instead of a plain HTMLCanvasElement singleton, enabling cache reuse
// across quranLayout and textReflow without DOM access.

export type Verse = {
  id: number;
  s: number;
  v: number;
  ar: string;
  bn: string;
  t_bn: string;
};

export type FlowLine = {
  arabicLine: string;
  banglaLine: string;
  markers: string[];
  startsSurah?: number;
  startsVerse?: number;
  lastVerse?: number;
  /** Resolved Arabic font-size for this line (px). */
  fontPx?: number;
};

function bnNum(n: number | string): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

function stripBanglaNumbering(s: string): string {
  if (!s) return s;
  return s.replace(/^\s*[(（]?[০-৯0-9]+[)）.।]\s*/g, "").trim();
}

/* ---------------- measurement ---------------- */
// Import the shared OffscreenCanvas measurement pool.
// Falls back to DOM or rough SSR estimate internally.
import { measureTextWidthCanvas } from "./canvasMeasure";

/** Active font used by the current pack pass. */
let _activeFontFamily = "";
let _activeFontPx = 0;

function setFont(fontPx: number, fontFamily: string) {
  _activeFontFamily = fontFamily;
  _activeFontPx = fontPx;
}

function measure(text: string): number {
  if (!_activeFontFamily || !_activeFontPx) return text.length * 12;
  // SSR: OffscreenCanvas not available — canvasMeasure falls back to DOM or estimate
  return measureTextWidthCanvas(text, _activeFontFamily, _activeFontPx);
}

/* ---------------- packing ---------------- */

type FlowOpts = {
  widthPx: number;
  arabicFontPx: number;
  arabicFamily: string;
  banglaFontPx: number;
  banglaFamily: string;
  /** Optional per-line font-size override. Called with the 0-based index of
   *  the line about to be packed within THIS verses[] call. Return the px
   *  font-size for that line, or undefined to use opts.arabicFontPx. */
  getRowFontPx?: (lineIndex: number) => number | undefined;
};

/** Reverse every run of Arabic-Indic / Extended Arabic-Indic digits in a
 *  string, keeping attached Quranic combining marks (tashkeel, small-high
 *  marks, End-of-Ayah U+06DD) bound to their base digit. Canvas / HTML RTL
 *  rendering draws digits in logical (LTR) order inside an RTL run, which
 *  makes multi-digit ayah numbers appear mirrored (e.g. 12 → 21). */
const AR_DIGIT = "[\\u0660-\\u0669\\u06F0-\\u06F9]";
const AR_COMBINING =
  "[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u200C\\u200D\\u2060\\uFEFF]";
const DIGIT_CLUSTER_RE = new RegExp(`${AR_DIGIT}${AR_COMBINING}*`, "g");
const DIGIT_RUN_RE = new RegExp(
  `(?:${AR_COMBINING}*${AR_DIGIT}${AR_COMBINING}*)+`,
  "g",
);

export function reverseArabicDigits(text: string): string {
  if (!text) return text;
  return text.replace(DIGIT_RUN_RE, (run) => {
    const clusters = run.match(DIGIT_CLUSTER_RE) ?? [];
    if (clusters.length === 0 || !clusters[0]) return run;
    const leading = run.slice(0, run.indexOf(clusters[0]));
    return leading + clusters.reverse().join("");
  });
}

/** Back-compat alias for older imports. */
export function glueMarkers(ar: string): string {
  return reverseArabicDigits(ar);
}

type ArabicLineMeta = {
  text: string;
  startsVerse?: number;
  startsSurah?: number;
  lastVerse?: number;
  fontPx?: number;
};

function packArabic(verses: Verse[], opts: FlowOpts): ArabicLineMeta[] {
  const baseFont = opts.arabicFontPx;
  const width = opts.widthPx;

  type Tok = { word: string; verse: Verse; isFirstWord: boolean };
  const tokens: Tok[] = [];
  for (const v of verses) {
    // Normalize whitespace, then reverse digit runs so ayah numbers render
    // in the correct visual order inside the RTL line.
    const ar = reverseArabicDigits(v.ar.replace(/\s+/g, " ").trim());
    const words = ar.split(" ");
    words.forEach((w, idx) => tokens.push({ word: w, verse: v, isFirstWord: idx === 0 }));
  }

  const lines: ArabicLineMeta[] = [];
  let cur: string[] = [];
  let startsVerse: Verse | null = null;
  let lastVerse: Verse | null = null;
  let currentLineFontPx = opts.getRowFontPx?.(0) ?? baseFont;
  setFont(currentLineFontPx, opts.arabicFamily);

  const flush = () => {
    if (cur.length === 0) return;
    lines.push({
      text: cur.join(" "),
      startsVerse: startsVerse?.v,
      startsSurah: startsVerse?.s,
      lastVerse: lastVerse?.v,
      fontPx: currentLineFontPx,
    });
    cur = [];
    startsVerse = null;
    lastVerse = null;
    // Switch font for the next line, if an override is provided.
    const nextIdx = lines.length;
    const nextFont = opts.getRowFontPx?.(nextIdx) ?? baseFont;
    if (nextFont !== currentLineFontPx) {
      currentLineFontPx = nextFont;
      setFont(currentLineFontPx, opts.arabicFamily);
    }
  };

  for (const tok of tokens) {
    const trial = cur.length === 0 ? tok.word : cur.join(" ") + " " + tok.word;
    if (measure(trial) <= width || cur.length === 0) {
      cur.push(tok.word);
      if (!startsVerse) startsVerse = tok.verse;
      lastVerse = tok.verse;
    } else {
      flush();
      cur.push(tok.word);
      startsVerse = tok.verse;
      lastVerse = tok.verse;
    }
  }
  flush();
  return lines;
}

function packBangla(verses: Verse[], opts: FlowOpts): string[] {
  setFont(opts.banglaFontPx, opts.banglaFamily);
  const width = opts.widthPx;

  const tokens: string[] = [];
  for (const v of verses) {
    const body = stripBanglaNumbering(v.t_bn || v.bn || "");
    const piece = `${bnNum(v.v)}। ${body}`.replace(/\s+/g, " ").trim();
    if (!piece) continue;
    for (const w of piece.split(" ")) tokens.push(w);
  }

  const lines: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    lines.push(cur.join(" "));
    cur = [];
  };
  for (const w of tokens) {
    const trial = cur.length === 0 ? w : cur.join(" ") + " " + w;
    if (measure(trial) <= width || cur.length === 0) {
      cur.push(w);
    } else {
      flush();
      cur.push(w);
    }
  }
  flush();
  return lines;
}

export function packVerses(verses: Verse[], opts: FlowOpts): FlowLine[] {
  const ar = packArabic(verses, opts);
  const bn = packBangla(verses, opts);
  const n = Math.max(ar.length, bn.length);
  const out: FlowLine[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      arabicLine: ar[i]?.text ?? "",
      banglaLine: bn[i] ?? "",
      markers: [],
      startsSurah: ar[i]?.startsSurah,
      startsVerse: ar[i]?.startsVerse,
      lastVerse: ar[i]?.lastVerse,
      fontPx: ar[i]?.fontPx,
    });
  }
  return out;
}
