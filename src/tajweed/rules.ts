// Tajweed rule parser. Scans a single Arabic line and returns the list of
// top-symbol matches in logical order. Each match references the base-character
// index inside the original string so measure.ts can locate it via Range.

import type { TopSymbolId } from "./svgMap";

export type TajweedMatch = {
  charIndex: number;
  symbol: TopSymbolId;
};

/* ---------------- character classes ---------------- */

const COMBINING_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u200C\u200D\u2060\uFEFF]/;
const TATWEEL = "\u0640";
const TASHKEEL = {
  FATHA: "\u064E",
  KASRA: "\u0650",
  DAMMA: "\u064F",
  FATHATAN: "\u064B",
  KASRATAN: "\u064D",
  DAMMATAN: "\u064C",
  SHADDA: "\u0651",
  SUKUN: "\u0652",
  DAGGER_ALIF: "\u0670",
};
const SHORT_VOWELS = [TASHKEEL.FATHA, TASHKEEL.KASRA, TASHKEEL.DAMMA];
const TANWEEN = new Set([TASHKEEL.FATHATAN, TASHKEEL.KASRATAN, TASHKEEL.DAMMATAN]);

const WAQF_MARKS = /[\u06D6-\u06DA\u06DC\u06DF-\u06E2\u06E4-\u06E8\u06EA-\u06ED\u0613-\u0615]/;
const AYAH_END = /[\u06DD]|[\u0660-\u0669\u06F0-\u06F9]+/;
const DIGIT_OR_WAQF_RE = /[\u0660-\u0669\u06F0-\u06F9\u06D6-\u06ED\u0613-\u0615\u06D5]/;

const HAMZA = new Set(["\u0621", "\u0623", "\u0625", "\u0624", "\u0626", "\u0622"]);
const MADD_BASES = new Set(["\u0627", "\u0649", "\u0648", "\u064A"]); // ا ى و ي
const QALQALAH = new Set(["\u0642", "\u0637", "\u0628", "\u062C", "\u062F"]); // ق ط ب ج د
const GHUNNA = new Set(["\u064A", "\u0648", "\u0645", "\u0646"]); // ي و م ن
const IKHFA = new Set([
  "\u062A", "\u062B", "\u062C", "\u062F", "\u0630", "\u0632", "\u0633",
  "\u0634", "\u0635", "\u0636", "\u0637", "\u0638", "\u0641", "\u0642", "\u0643",
]);
const NOON = "\u0646";
const MEEM = "\u0645";
const YAA = "\u064A";
const ALIF_MAKSURA = "\u0649";
const WAW = "\u0648";
const ALIF = "\u0627";
const ALIF_WASLA = "\u0671";

/* ---------------- lexical exception: name of Allah ---------------- */

const HARAKAT_RE = /[\u064B-\u0650\u0652\u0670\u0651\u0671\u0640]/g;
function stripHarakat(s: string) {
  return s.replace(/\u0671/g, "\u0627").replace(HARAKAT_RE, "");
}

const LAFZ_ALLAH = new Set([
  "الله", "لله", "بالله", "تالله", "ولله", "فلله", "اللهم",
]);

/* ---------------- clustering ---------------- */

type Cluster = {
  base: string;
  marks: string[];
  index: number;
  word: number;
};

function clusterize(text: string): Cluster[] {
  const out: Cluster[] = [];
  let word = 0;
  let i = 0;
  let sawWordChar = false;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (sawWordChar) word += 1;
      sawWordChar = false;
      i += 1;
      continue;
    }
    // Skip tatweel, digits, ayah/waqf marks, decorative ە — they are not pronounced letters.
    if (ch === TATWEEL || DIGIT_OR_WAQF_RE.test(ch)) {
      i += 1;
      continue;
    }
    if (COMBINING_RE.test(ch)) {
      if (out.length > 0) out[out.length - 1].marks.push(ch);
      i += 1;
      continue;
    }
    const cl: Cluster = { base: ch, marks: [], index: i, word };
    sawWordChar = true;
    i += 1;
    while (i < text.length && COMBINING_RE.test(text[i])) {
      cl.marks.push(text[i]);
      i += 1;
    }
    out.push(cl);
  }
  return out;
}

const has = (c: Cluster, m: string) => c.marks.includes(m);
const hasAny = (c: Cluster, set: Set<string>) => c.marks.some((m) => set.has(m));

function wordString(text: string, cluster: Cluster): string {
  let start = cluster.index;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  let end = cluster.index + 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  return text.slice(start, end);
}

function isLafzAllah(text: string, cluster: Cluster): boolean {
  return LAFZ_ALLAH.has(stripHarakat(wordString(text, cluster)));
}

/** Next pronounced cluster index, skipping:
 *  - alif-wasla (U+0671)
 *  - a bare alif at the start of a new word (hamzat al-wasl in plain form)
 *  - the definite-article ل with no marks that follows such an alif when the
 *    cluster after it carries a shadda (lām-shamsiyya assimilation). */
function nextPronouncedIdx(clusters: Cluster[], from: number): number {
  let skippedWaslAlif = false;
  for (let i = from + 1; i < clusters.length; i++) {
    const n = clusters[i];
    if (n.base === ALIF_WASLA) { skippedWaslAlif = true; continue; }
    if (n.base === ALIF && n.word !== clusters[from].word && n.marks.length === 0) {
      skippedWaslAlif = true;
      continue;
    }
    // Skip silent ل of the definite article when the following consonant is doubled.
    if (
      skippedWaslAlif &&
      n.base === "\u0644" &&
      n.marks.length === 0 &&
      i + 1 < clusters.length &&
      clusters[i + 1].word === n.word &&
      has(clusters[i + 1], TASHKEEL.SHADDA)
    ) {
      skippedWaslAlif = false;
      continue;
    }
    return i;
  }
  return -1;
}

/* ---------------- madd analysis ---------------- */

type MaddInfo = {
  /** cluster index in `clusters` */
  clusterIdx: number;
  /** cluster that carries the harakat producing the madd (placement target) */
  carrier: Cluster;
  /** word id of the madd */
  word: number;
};

/** If the cluster at index k participates in a Madd Asli, return info. */
function maddAt(clusters: Cluster[], k: number): MaddInfo | null {
  const c = clusters[k];
  const prev = clusters[k - 1];

  // Dagger alif sits directly on its consonant → carrier is c itself.
  if (has(c, TASHKEEL.DAGGER_ALIF)) {
    return { clusterIdx: k, carrier: c, word: c.word };
  }

  if (!prev || !MADD_BASES.has(c.base)) return null;
  // Same word required for prev → carrier relationship.
  if (prev.word !== c.word) return null;
  // c must not carry its own short vowel.
  if (c.marks.some((m) => SHORT_VOWELS.includes(m))) return null;

  if (c.base === ALIF && has(prev, TASHKEEL.FATHA)) {
    return { clusterIdx: k, carrier: prev, word: c.word };
  }
  if ((c.base === YAA || c.base === ALIF_MAKSURA) && has(prev, TASHKEEL.KASRA)) {
    // Not Layn (Layn requires fatha on prev) — accept sukun-yā as Madd Asli.
    return { clusterIdx: k, carrier: prev, word: c.word };
  }
  if (c.base === WAW && has(prev, TASHKEEL.DAMMA)) {
    return { clusterIdx: k, carrier: prev, word: c.word };
  }
  return null;
}

function isStopAfter(text: string, c: Cluster, nextRawIdx: number): boolean {
  const end = nextRawIdx >= 0 ? nextRawIdx : text.length;
  const tail = text.slice(c.index + 1, end);
  if (WAQF_MARKS.test(tail)) return true;
  if (AYAH_END.test(tail)) return true;
  if (nextRawIdx < 0) return true;
  return false;
}

/** Find the raw text index of the start of the next pronounced cluster after
 *  cluster `c`, or -1 if none. Used by isStopAfter to bound the tail scan. */
function nextRawStart(clusters: Cluster[], k: number): number {
  if (k + 1 < clusters.length) return clusters[k + 1].index;
  return -1;
}

/** Is the word followed by a waqf (ayah-end digit or waqf mark)? */
function wordIsBeforeWaqf(text: string, clusters: Cluster[], lastClusterIdxInWord: number): boolean {
  const c = clusters[lastClusterIdxInWord];
  // Scan raw text from after the last cluster's base char to next non-space pronounced char.
  let i = c.index + 1;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (COMBINING_RE.test(ch)) { i += 1; continue; }
    if (ch === TATWEEL) { i += 1; continue; }
    if (DIGIT_OR_WAQF_RE.test(ch)) return true;
    return false;
  }
  return true; // end of input
}

/* ---------------- main ---------------- */

export function detectTajweed(text: string): TajweedMatch[] {
  if (!text) return [];
  const clusters = clusterize(text);
  const matches = new Map<number, TopSymbolId>();

  const set = (idx: number, id: TopSymbolId) => {
    const cur = matches.get(idx);
    if (cur === undefined || id < cur) matches.set(idx, id);
  };

  // ---- pre-compute madd info and group by word ----
  const madds: MaddInfo[] = [];
  const lastClusterOfWord = new Map<number, number>();
  for (let k = 0; k < clusters.length; k++) {
    lastClusterOfWord.set(clusters[k].word, k);
    const m = maddAt(clusters, k);
    if (m && !isLafzAllah(text, clusters[k])) madds.push(m);
  }
  // For each word, the cluster-index of the LAST madd in that word.
  const lastMaddOfWord = new Map<number, number>();
  for (const m of madds) {
    const prev = lastMaddOfWord.get(m.word);
    if (prev === undefined || m.clusterIdx > prev) lastMaddOfWord.set(m.word, m.clusterIdx);
  }

  // ---- apply madd rules ----
  for (const m of madds) {
    const k = m.clusterIdx;
    const c = clusters[k];
    const npIdx = nextPronouncedIdx(clusters, k);
    const np = npIdx >= 0 ? clusters[npIdx] : undefined;

    // Iltiqa as-Sakinayn across words → next has sukun or shadda → no symbol.
    if (np && np.word !== c.word && (has(np, TASHKEEL.SUKUN) || has(np, TASHKEEL.SHADDA))) continue;

    // Madd Lazim Muthaqqal Kalimi (Kariana) — shadda on a WEAK madd letter
    // (ي / و) e.g. إِيَّاكَ → ي. Strong-consonant shadda from Idgham Shamsi
    // (e.g. لَّا in الَّذِي) is just Madd Asli, so we exclude it here.
    if (has(m.carrier, TASHKEEL.SHADDA) && (m.carrier.base === YAA || m.carrier.base === WAW)) {
      set(m.carrier.index, 4);
      continue;
    }
    // Madd Lazim — next pronounced has shadda (within same word). Rule 4.
    if (np && np.word === c.word && has(np, TASHKEEL.SHADDA)) {
      set(m.carrier.index, 4);
      continue;
    }
    // Madd Lazim — next pronounced has sukun within same word. Rule 4.
    if (np && np.word === c.word && has(np, TASHKEEL.SUKUN)) {
      set(m.carrier.index, 4);
      continue;
    }
    // Madd Munfasil — next word starts with a hamza letter. Rule 3.
    if (np && np.word !== c.word && HAMZA.has(np.base)) {
      set(m.carrier.index, 3);
      continue;
    }
    // Madd Muttasil — hamza in same word after the madd. Rule 4.
    if (np && np.word === c.word && HAMZA.has(np.base)) {
      set(m.carrier.index, 4);
      continue;
    }

    // Madd Aridh Li-Sukun — LAST madd of the word AND the word is followed by waqf.
    const isLastMadd = lastMaddOfWord.get(m.word) === k;
    const wordLastClusterIdx = lastClusterOfWord.get(m.word) ?? k;
    if (isLastMadd && wordIsBeforeWaqf(text, clusters, wordLastClusterIdx)) {
      set(m.carrier.index, 6);
      continue;
    }

    // Default — Madd Asli. Rule 1.
    set(m.carrier.index, 1);
  }

  // ---- per-cluster rules (Layn, Qalqalah, Ghunnah, Ikhfa, Iwad, last-letter) ----
  for (let k = 0; k < clusters.length; k++) {
    const c = clusters[k];
    const prev = clusters[k - 1];
    const next = clusters[k + 1];

    // Rule 2 — Madd Layn: fatha + (يْ|وْ), immediately followed by a single
    // consonant that is the LAST letter of the word (e.g. يَوْمِ، غَيْرِ).
    if (
      (c.base === YAA || c.base === WAW) &&
      has(c, TASHKEEL.SUKUN) &&
      prev &&
      prev.word === c.word &&
      has(prev, TASHKEEL.FATHA) &&
      !has(prev, TASHKEEL.SHADDA) &&
      next &&
      next.word === c.word &&
      (!clusters[k + 2] || clusters[k + 2].word !== c.word)
    ) {
      set(c.index, 2);
    }

    // Rule 5 — Madd-e-Iwad: Fathatan at ayah end.
    if (has(c, TASHKEEL.FATHATAN) && isStopAfter(text, c, nextRawStart(clusters, k))) {
      set(c.index, 5);
    }

    // Rule 7A — Meem/Noon with Shadda (Wajib Ghunnah).
    if ((c.base === MEEM || c.base === NOON) && has(c, TASHKEEL.SHADDA)) {
      set(c.index, 7);
    }

    // Rule 8 — Qalqalah letters with Sukun (or stopped at word end).
    if (QALQALAH.has(c.base)) {
      const isLastOfWord = !next || next.word !== c.word;
      if (has(c, TASHKEEL.SUKUN) || (isLastOfWord && isStopAfter(text, c, nextRawStart(clusters, k)))) {
        set(c.index, 8);
      }
    }

    // Rule 11 — Ikhfa, and Rule 7B — Idgham Bighunnah, after Noon Sakin / Tanween.
    const isNoonSakin = c.base === NOON && has(c, TASHKEEL.SUKUN);
    const hasTanween = hasAny(c, TANWEEN);
    if ((isNoonSakin || hasTanween) && next) {
      if (GHUNNA.has(next.base)) {
        set(next.index, 7);
      } else if (IKHFA.has(next.base)) {
        set(c.index, 11);
      }
    }

    // Rule 12 — last pronounced letter of a word that ends at a stop.
    const isLastOfWord = !next || next.word !== c.word;
    if (isLastOfWord && isStopAfter(text, c, nextRawStart(clusters, k))) {
      set(c.index, 12);
    }
  }

  return [...matches.entries()]
    .map(([charIndex, symbol]) => ({ charIndex, symbol }))
    .sort((a, b) => a.charIndex - b.charIndex);
}
