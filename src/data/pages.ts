import pagesData from "./pages.json";
import fatihaData from "./fatiha.json";
import { packVerses, type Verse as FlowVerse } from "@/lib/quranLayout";

export type WordBlockData = {
  symbol?: string;
  arabic: string;
  bangla: string;
};

export type SurahOpenSlot = {
  kind: "surah-open";
  surahName: string;
  revelation: string;
  ayah: string;
  ruku: string;
  bismillahArabic: string;
  bismillahBangla: string;
};

export type GridLineData = {
  markers?: string[];
  blocks: WordBlockData[];
  banglaLine?: string;
  arabicLine?: string;
  slotKind?: "ayah" | "surah-open" | "blank";
  surahOpen?: SurahOpenSlot;
};

export type FooterData = {
  surah: string;
  revelation: string;
  pageNo: string | number;
  ayah: string;
  ruku: string;
  manzil: string;
};

export type SurahOpenPage = {
  id: string;
  type: "surah-open";
  surahName: string;
  revelation: "মাক্কী" | "মাদানী";
  ayah: string;
  ruku: string;
  bismillahArabic: string;
  bismillahBangla: string;
  lines: GridLineData[];
  footer: FooterData;
};

export type ContinuousPage = {
  id: string;
  type: "continuous";
  para: string;
  title: string;
  chapter: string;
  lines: GridLineData[];
  footer: FooterData;
};

export type PageData = SurahOpenPage | ContinuousPage;

const SURAH_NAMES: Record<number, string> = {
  1: "আল-ফাতিহা",
  2: "আল-বাকারা",
  3: "আলে ইমরান",
  4: "আন-নিসা",
  5: "আল-মায়িদাহ",
  6: "আল-আনআম",
  7: "আল-আরাফ",
  8: "আল-আনফাল",
  9: "আত-তাওবা",
};

function bnNum(n: number | string): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

const LINES_PER_PAGE = 9;
const BISMILLAH_AR = "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ";
const BISMILLAH_BN = "অসীম করুণাময় ও পরম দয়ালু আল্লাহর নামে শুরু করছি";
const SURAH_OPEN_SPAN = 2;

// Geometry constants — kept in sync with Artboard.tsx.
// Geometry constants — kept in sync with Artboard.tsx and FabricLines.tsx.
const VB_W = 420.17;
const DISPLAY_W = 780;
const SCALE = DISPLAY_W / VB_W;
const LINE_W = 412.58 - 7.46;
export const SIDE_PAD_PX = 8;
// Extra 3px safety margin absorbs sub-pixel rounding and kashida stretch
// between canvas measurement and DOM justified rendering, so no line
// overflows the side padding on either end.
const GRID_W_PX = LINE_W * SCALE - 2 * SIDE_PAD_PX - 3;
export const ARABIC_FONT_PX = 50;
const ARABIC_FAMILY = "'Excellent Arabic', 'Amiri Quran', 'Scheherazade New', serif";
export const BANGLA_FONT_PX = 18;
const BANGLA_FAMILY = "'Kalpurush', 'Noto Serif Bengali', serif";

function surahMeta(verses: FlowVerse[], s: number) {
  const list = verses.filter((v) => v.s === s);
  const ayahCount = list.length;
  return {
    name: SURAH_NAMES[s] ?? `সূরা ${bnNum(s)}`,
    revelation: s === 1 || s >= 89 ? "মাক্কী" : "মাদানী",
    ayah: bnNum(ayahCount),
    ruku: bnNum(Math.max(1, Math.ceil(ayahCount / 20))),
  };
}

function surahOpenSlot(s: number, verses: FlowVerse[]): GridLineData {
  const m = surahMeta(verses, s);
  return {
    slotKind: "surah-open",
    blocks: [],
    surahOpen: {
      kind: "surah-open",
      surahName: m.name,
      revelation: m.revelation,
      ayah: m.ayah,
      ruku: m.ruku,
      bismillahArabic: BISMILLAH_AR,
      bismillahBangla: BISMILLAH_BN,
    },
  };
}

function blankSlot(): GridLineData {
  return { slotKind: "blank", blocks: [] };
}

export type BuildOpts = {
  arabicFontPx?: number;
  banglaFontPx?: number;
  /** Per-row font overrides keyed by `row:{pageId}:{rowIndex}`. */
  rowFontOverrides?: Record<string, number>;
};

export function buildPagesFromVerses(
  verses: FlowVerse[],
  startVerseId: number,
  startPageNo: number,
  prevSurah: number,
  defaultMarkers: string[],
  opts: BuildOpts = {},
): ContinuousPage[] {
  const arabicFontPx = opts.arabicFontPx ?? ARABIC_FONT_PX;
  const banglaFontPx = opts.banglaFontPx ?? BANGLA_FONT_PX;
  const rowOverrides = opts.rowFontOverrides ?? {};

  const queue = verses.filter((v) => v.id >= startVerseId);
  // Group by surah while preserving order.
  const surahGroups: { s: number; verses: FlowVerse[] }[] = [];
  for (const v of queue) {
    const last = surahGroups[surahGroups.length - 1];
    if (last && last.s === v.s) last.verses.push(v);
    else surahGroups.push({ s: v.s, verses: [v] });
  }

  type PageSlot = GridLineData & { _firstV?: number; _lastV?: number; _surah?: number };
  const pages: ContinuousPage[] = [];
  let pageNo = startPageNo;
  let pageSlots: PageSlot[] = [];
  let firstV: number | null = null;
  let lastV: number | null = null;
  let pageSurah: number = prevSurah;

  const flushPage = (pad = true) => {
    if (pageSlots.length === 0) return;
    if (pad) while (pageSlots.length < LINES_PER_PAGE) pageSlots.push(blankSlot());
    const m = surahMeta(verses, pageSurah);
    pages.push({
      id: `vpage-${pageNo}`,
      type: "continuous",
      para: `পারা ${bnNum(Math.min(30, Math.ceil(pageNo / 20)))}`,
      title: m.name,
      chapter:
        firstV != null
          ? `সূরা ${bnNum(pageSurah)} • আয়াত ${bnNum(firstV)}–${bnNum(lastV!)}`
          : m.name,
      lines: pageSlots,
      footer: {
        surah: m.name,
        revelation: m.revelation,
        pageNo: bnNum(pageNo),
        ayah:
          firstV != null
            ? `আয়াত ${bnNum(firstV)}–${bnNum(lastV!)}`
            : `আয়াত ${m.ayah}`,
        ruku: `রুকু ${bnNum(Math.ceil(pageNo / 8))}`,
        manzil: `মাঞ্জিল ${bnNum(Math.min(7, Math.ceil(pageNo / 90)))}`,
      },
    });
    pageNo++;
    pageSlots = [];
    firstV = null;
    lastV = null;
  };

  for (let gi = 0; gi < surahGroups.length; gi++) {
    const grp = surahGroups[gi];

    // Insert surah-open block when crossing into a new surah (not for the very first group).
    if (grp.s !== prevSurah) {
      const remaining = LINES_PER_PAGE - pageSlots.length;
      if (remaining < SURAH_OPEN_SPAN + 1) flushPage();
      pageSlots.push(surahOpenSlot(grp.s, verses));
      pageSlots.push(blankSlot());
      pageSurah = grp.s;
      prevSurah = grp.s;
    } else if (pageSlots.length === 0) {
      pageSurah = grp.s;
    }

    // Predict the (pageNo, slotIdx) destination of each upcoming packed line
    // so the engine can look up per-row font overrides BEFORE packing.
    const startPn = pageNo;
    const startSi = pageSlots.length;
    const predictSlot = (lineIdx: number): { pn: number; si: number } => {
      let pn = startPn;
      let si = startSi;
      for (let k = 0; k < lineIdx; k++) {
        si++;
        if (si >= LINES_PER_PAGE) {
          pn++;
          si = 0;
        }
      }
      return { pn, si };
    };
    const getRowFontPx = (lineIdx: number): number | undefined => {
      const { pn, si } = predictSlot(lineIdx);
      return rowOverrides[`row:vpage-${pn}:${si}`];
    };

    // Flow this surah's verses into lines, then push line-by-line.
    const lines = packVerses(grp.verses, {
      widthPx: GRID_W_PX,
      arabicFontPx,
      arabicFamily: ARABIC_FAMILY,
      banglaFontPx,
      banglaFamily: BANGLA_FAMILY,
      getRowFontPx,
    });

    for (const fl of lines) {
      if (pageSlots.length >= LINES_PER_PAGE) flushPage();
      if (pageSlots.length === 0) pageSurah = grp.s;
      pageSlots.push({
        slotKind: "ayah",
        arabicLine: fl.arabicLine,
        banglaLine: fl.banglaLine,
        blocks: [],
        markers: defaultMarkers,
      });
      if (fl.startsVerse != null && firstV == null) firstV = fl.startsVerse;
      if (fl.lastVerse != null) lastV = fl.lastVerse;
    }
  }
  flushPage();
  return pages;
}

export const meta = pagesData.meta;
const defaultMarkers = (pagesData.meta.defaultMarkers ?? []) as string[];

/** Page 1 (Fatiha) is built from the same verses.json source as later pages
 *  so the Tajweed rule pipeline sees identical Arabic clusters everywhere.
 *  A pre-filtered subset (fatiha.json) keeps first-paint fast without loading
 *  the full 6KB-line corpus synchronously. */
const fatihaVerses = fatihaData as FlowVerse[];
const fatihaPages = buildPagesFromVerses(fatihaVerses, 1, 1, 0, defaultMarkers);

/** Instantly available — Fatiha page 1, generated from canonical verses. */
export const pagesSync: PageData[] = fatihaPages;

let cachedVerses: FlowVerse[] | null = null;
let versesPromise: Promise<FlowVerse[]> | null = null;

/** Async — fetches verses.json on first call, caches the array. */
export function loadAllVerses(): Promise<FlowVerse[]> {
  if (cachedVerses) return Promise.resolve(cachedVerses);
  if (versesPromise) return versesPromise;
  versesPromise = (async () => {
    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      try {
        await (document as any).fonts.load(`${ARABIC_FONT_PX}px 'Excellent Arabic'`);
        await (document as any).fonts.load(`${BANGLA_FONT_PX}px 'Kalpurush'`);
        await (document as any).fonts.ready;
      } catch {
        /* ignore */
      }
    }
    const mod = await import("./verses.json");
    const verses = ((mod as any).default ?? mod) as FlowVerse[];
    cachedVerses = verses;
    return verses;
  })();
  return versesPromise;
}

/** Build the full pages array from cached verses, applying overrides. */
export function buildAllPages(opts: BuildOpts = {}): PageData[] {
  const rebuiltFatiha = buildPagesFromVerses(fatihaVerses, 1, 1, 0, defaultMarkers, opts);
  if (!cachedVerses) return rebuiltFatiha;
  const generated = buildPagesFromVerses(cachedVerses, 8, 2, 1, defaultMarkers, opts);
  return [...rebuiltFatiha, ...generated];
}

/** Back-compat: async loader returning default (un-overridden) pages. */
let cached: PageData[] | null = null;
export async function loadGeneratedPages(): Promise<PageData[]> {
  if (cached) return cached;
  await loadAllVerses();
  cached = buildAllPages();
  return cached;
}

/** Back-compat: synchronous export contains only designed pages until hydrated. */
export const pages: PageData[] = pagesSync;

// ─────────────────────────────────────────────────────────────────────────
// Chunked async builder — yields between surah groups so the main thread
// stays responsive while ~1740 pages are rebuilt.
// ─────────────────────────────────────────────────────────────────────────

export type ChunkProgress = { done: number; total: number; label: string };

const SURAH_GROUPS_PER_CHUNK = 5;

function scheduleIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => resolve(), { timeout: 200 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

class AbortError extends Error {
  override name = "AbortError";
}

async function buildPagesFromVersesChunked(
  verses: FlowVerse[],
  startVerseId: number,
  startPageNo: number,
  prevSurahArg: number,
  defaultMarkersArg: string[],
  opts: BuildOpts,
  onProgress: ((p: ChunkProgress) => void) | undefined,
  signal: AbortSignal | undefined,
  progressOffset: number,
  progressTotal: number,
): Promise<ContinuousPage[]> {
  const arabicFontPx = opts.arabicFontPx ?? ARABIC_FONT_PX;
  const banglaFontPx = opts.banglaFontPx ?? BANGLA_FONT_PX;
  const rowOverrides = opts.rowFontOverrides ?? {};

  const queue = verses.filter((v) => v.id >= startVerseId);
  const surahGroups: { s: number; verses: FlowVerse[] }[] = [];
  for (const v of queue) {
    const last = surahGroups[surahGroups.length - 1];
    if (last && last.s === v.s) last.verses.push(v);
    else surahGroups.push({ s: v.s, verses: [v] });
  }

  type PageSlot = GridLineData;
  const out: ContinuousPage[] = [];
  let pageNo = startPageNo;
  let pageSlots: PageSlot[] = [];
  let firstV: number | null = null;
  let lastV: number | null = null;
  let pageSurah: number = prevSurahArg;
  let prevSurah = prevSurahArg;

  const flushPage = (pad = true) => {
    if (pageSlots.length === 0) return;
    if (pad) while (pageSlots.length < LINES_PER_PAGE) pageSlots.push(blankSlot());
    const m = surahMeta(verses, pageSurah);
    out.push({
      id: `vpage-${pageNo}`,
      type: "continuous",
      para: `পারা ${bnNum(Math.min(30, Math.ceil(pageNo / 20)))}`,
      title: m.name,
      chapter:
        firstV != null
          ? `সূরা ${bnNum(pageSurah)} • আয়াত ${bnNum(firstV)}–${bnNum(lastV!)}`
          : m.name,
      lines: pageSlots,
      footer: {
        surah: m.name,
        revelation: m.revelation,
        pageNo: bnNum(pageNo),
        ayah:
          firstV != null
            ? `আয়াত ${bnNum(firstV)}–${bnNum(lastV!)}`
            : `আয়াত ${m.ayah}`,
        ruku: `রুকু ${bnNum(Math.ceil(pageNo / 8))}`,
        manzil: `মাঞ্জিল ${bnNum(Math.min(7, Math.ceil(pageNo / 90)))}`,
      },
    });
    pageNo++;
    pageSlots = [];
    firstV = null;
    lastV = null;
  };

  for (let gi = 0; gi < surahGroups.length; gi++) {
    if (signal?.aborted) throw new AbortError("aborted");
    const grp = surahGroups[gi];

    if (grp.s !== prevSurah) {
      const remaining = LINES_PER_PAGE - pageSlots.length;
      if (remaining < SURAH_OPEN_SPAN + 1) flushPage();
      pageSlots.push(surahOpenSlot(grp.s, verses));
      pageSlots.push(blankSlot());
      pageSurah = grp.s;
      prevSurah = grp.s;
    } else if (pageSlots.length === 0) {
      pageSurah = grp.s;
    }

    const startPn = pageNo;
    const startSi = pageSlots.length;
    const predictSlot = (lineIdx: number): { pn: number; si: number } => {
      let pn = startPn;
      let si = startSi;
      for (let k = 0; k < lineIdx; k++) {
        si++;
        if (si >= LINES_PER_PAGE) {
          pn++;
          si = 0;
        }
      }
      return { pn, si };
    };
    const getRowFontPx = (lineIdx: number): number | undefined => {
      const { pn, si } = predictSlot(lineIdx);
      return rowOverrides[`row:vpage-${pn}:${si}`];
    };

    const lines = packVerses(grp.verses, {
      widthPx: GRID_W_PX,
      arabicFontPx,
      arabicFamily: ARABIC_FAMILY,
      banglaFontPx,
      banglaFamily: BANGLA_FAMILY,
      getRowFontPx,
    });

    for (const fl of lines) {
      if (pageSlots.length >= LINES_PER_PAGE) flushPage();
      if (pageSlots.length === 0) pageSurah = grp.s;
      pageSlots.push({
        slotKind: "ayah",
        arabicLine: fl.arabicLine,
        banglaLine: fl.banglaLine,
        blocks: [],
        markers: defaultMarkersArg,
      });
      if (fl.startsVerse != null && firstV == null) firstV = fl.startsVerse;
      if (fl.lastVerse != null) lastV = fl.lastVerse;
    }

    if ((gi + 1) % SURAH_GROUPS_PER_CHUNK === 0 || gi === surahGroups.length - 1) {
      onProgress?.({
        done: progressOffset + gi + 1,
        total: progressTotal,
        label: `পেজ তৈরি হচ্ছে… (${out.length})`,
      });
      await scheduleIdle();
      if (signal?.aborted) throw new AbortError("aborted");
    }
  }
  flushPage();
  return out;
}

/**
 * Async chunked equivalent of buildAllPages(). Yields to the event loop
 * between surah groups so slider drags stay smooth.
 */
export async function buildAllPagesChunked(
  opts: BuildOpts = {},
  onProgress?: (p: ChunkProgress) => void,
  signal?: AbortSignal,
): Promise<PageData[]> {
  const rebuiltFatiha = buildPagesFromVerses(fatihaVerses, 1, 1, 0, defaultMarkers, opts);
  if (!cachedVerses) {
    onProgress?.({ done: 1, total: 1, label: "প্রস্তুত" });
    return rebuiltFatiha;
  }

  let totalGroups = 0;
  let prev = -1;
  for (const v of cachedVerses) {
    if (v.s !== prev) {
      totalGroups++;
      prev = v.s;
    }
  }

  const generated = await buildPagesFromVersesChunked(
    cachedVerses,
    8,
    2,
    1,
    defaultMarkers,
    opts,
    onProgress,
    signal,
    0,
    totalGroups,
  );
  return [...rebuiltFatiha, ...generated];
}
