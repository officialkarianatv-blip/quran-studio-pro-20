import { create } from "zustand";
import {
  buildAllPages,
  buildAllPagesChunked,
  buildPagesFromVerses,
  loadAllVerses,
  pagesSync,
  ARABIC_FONT_PX,
  BANGLA_FONT_PX,
  type PageData,
} from "@/data/pages";
import { useOverridesStore, MASTER_DEFAULTS } from "@/state/overridesStore";

export type PageDistribution = {
  pageId: string;
  pageNo: number;
  surah: number;
  firstVerse: number | null;
  lastVerse: number | null;
  rowCount: number;
};

export type BuildProgress = {
  /** Short status label in Bengali */
  label: string;
  /** 0–100 */
  pct: number;
};

type ReflowState = {
  pages: PageData[];
  distribution: PageDistribution[];
  status: "idle" | "loading" | "ready";
  /** Null when no build is in progress */
  buildProgress: BuildProgress | null;
  /** True while a large cross-page cascade is running in the background */
  isReflowing: boolean;
  signature: string;
  versesReady: boolean;
  rebuilding: boolean;
  init: () => Promise<void>;
  rebuild: () => void;
  /** Optimistic: idle-scheduled single-page rebuild for instant feedback. */
  rebuildPage: (pageId: string) => void;
  setIsReflowing: (v: boolean) => void;
};

function computeDistribution(pages: PageData[]): PageDistribution[] {
  const bnToNum = (s: string | number): number => {
    if (typeof s === "number") return s;
    const map: Record<string, string> = {
      "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
      "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    };
    return Number(String(s).replace(/[০-৯]/g, (c) => map[c] ?? c)) || 0;
  };
  return pages.map((p) => {
    const ayahLines = p.lines.filter((l) => l.slotKind === "ayah");
    const id = p.id;
    const pageNo = bnToNum(p.footer.pageNo);
    const surahMatch = /সূরা\s*([০-৯]+)/.exec(
      "chapter" in p ? p.chapter : "",
    );
    const surah = surahMatch ? bnToNum(surahMatch[1]!) : 0;
    let firstVerse: number | null = null;
    let lastVerse: number | null = null;
    const ayahMatch = /আয়াত\s*([০-৯]+)–([০-৯]+)/.exec(p.footer.ayah);
    if (ayahMatch) {
      firstVerse = bnToNum(ayahMatch[1]!);
      lastVerse = bnToNum(ayahMatch[2]!);
    }
    return { pageId: id, pageNo, surah, firstVerse, lastVerse, rowCount: ayahLines.length };
  });
}

function computeSignature(): string {
  const s = useOverridesStore.getState();
  const g = s.global;
  const parts: string[] = [
    `g:${g.arabicFontPx ?? ""}|${g.banglaFontPx ?? ""}|${g.rowSpacing ?? ""}`,
  ];
  const keys = Object.keys(s.local).sort();
  for (const k of keys) {
    if (!k.startsWith("row:")) continue;
    const ov = s.local[k];
    if (ov?.fontPx == null && ov?.scale == null) continue;
    parts.push(`${k}:${ov.fontPx ?? ""}:${ov.scale ?? ""}`);
  }
  return parts.join("¦");
}

function collectRowFontOverrides(): Record<string, number> {
  const local = useOverridesStore.getState().local;
  const out: Record<string, number> = {};
  for (const k of Object.keys(local)) {
    if (!k.startsWith("row:")) continue;
    const fp = local[k]?.fontPx;
    if (typeof fp === "number") out[k] = fp;
  }
  return out;
}

export const useReflowStore = create<ReflowState>((set, get) => ({
  pages: pagesSync,
  distribution: computeDistribution(pagesSync),
  status: "idle",
  buildProgress: null,
  isReflowing: false,
  signature: "",
  versesReady: false,
  rebuilding: false,
  setIsReflowing: (v) => set({ isReflowing: v }),

  init: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading", buildProgress: { label: "শুরু হচ্ছে…", pct: 5 } });

    // Stage 1 — load Arabic font
    if (typeof document !== "undefined" && (document as any).fonts?.load) {
      set({ buildProgress: { label: "আরবি ফন্ট লোড হচ্ছে…", pct: 20 } });
      try {
        await (document as any).fonts.load(`${ARABIC_FONT_PX}px 'Excellent Arabic'`);
        await (document as any).fonts.load(`${BANGLA_FONT_PX}px 'Kalpurush'`);
      } catch { /* ignore */ }
    }

    // Stage 2 — fetch verses.json (~5.6 MB)
    set({ buildProgress: { label: "আয়াত ডেটা লোড হচ্ছে…", pct: 40 } });
    await loadAllVerses();
    set({ versesReady: true, buildProgress: { label: "পেজ তৈরি হচ্ছে…", pct: 70 } });

    // Stage 3 — build all pages (scheduled in idle callback by rebuild())
    get().rebuild();
    set({ status: "ready", buildProgress: { label: "প্রস্তুত!", pct: 100 } });

    // Clear progress after a short delay so the bar finishes visually
    setTimeout(() => set({ buildProgress: null }), 800);
  },

  /**
   * Optimistic single-page rebuild — updates only the target page instantly
   * so the user sees immediate feedback without waiting for the full rebuild.
   *
   * Called from PropertiesPanel / Inspector when the user adjusts a value
   * that affects only the active page (e.g. per-row font size override).
   */
  rebuildPage: (pageId: string) => {
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
    };

    const currentPages = get().pages;
    if (!currentPages.find((p) => p.id === pageId)) return;

    // Idle-schedule the rebuild so it doesn't block the main thread while
    // the user is actively dragging a slider (optimistic UI stays responsive).
    const scheduleIdle =
      typeof requestIdleCallback !== "undefined"
        ? (cb: IdleRequestCallback) => requestIdleCallback(cb, { timeout: 200 })
        : (cb: IdleRequestCallback) =>
            setTimeout(
              () => cb({ timeRemaining: () => 50, didTimeout: false } as IdleDeadline),
              0,
            );

    scheduleIdle(() => {
      // Re-read current pages at time of execution (may have changed)
      const pages = get().pages;
      const allPages = buildAllPages(opts);
      const updatedPage = allPages.find((p) => p.id === pageId);
      if (!updatedPage) return;
      const newPages = pages.map((p) => (p.id === pageId ? updatedPage : p));
      set({ pages: newPages, distribution: computeDistribution(newPages) });
    });
  },

  /**
   * Full rebuild — splits work across multiple `requestIdleCallback` frames
   * so the main thread stays responsive and sliders don't freeze.
   *
   * Strategy:
   * 1. Compute new signature. If unchanged → skip.
   * 2. Kick off chunked idle processing.
   * 3. Each idle callback processes ~60 pages before yielding.
   * 4. When all chunks are done → commit to state.
   */
  rebuild: () => {
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
    };
    const sig = computeSignature();

    // Cancel any in-flight rebuild so only the latest one commits.
    currentRebuildAbort?.abort();
    const abort = new AbortController();
    currentRebuildAbort = abort;

    set({ rebuilding: true });

    buildAllPagesChunked(
      opts,
      (p) => {
        if (abort.signal.aborted) return;
        set({
          buildProgress: {
            label: p.label,
            pct: Math.max(1, Math.min(99, Math.round((p.done / p.total) * 100))),
          },
        });
      },
      abort.signal,
    )
      .then((pages) => {
        if (abort.signal.aborted) return;
        if (sig !== computeSignature()) return; // stale — newer rebuild will commit
        set({
          pages,
          distribution: computeDistribution(pages),
          signature: sig,
          rebuilding: false,
          buildProgress: null,
        });
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        // eslint-disable-next-line no-console
        console.error("[reflow] rebuild failed", e);
        set({ rebuilding: false, buildProgress: null });
      });
  },
}));

let currentRebuildAbort: AbortController | null = null;

/**
 * Subscribe overrides → debounced rebuild (400ms idle window).
 * This prevents rebuilding on every slider tick — only fires after
 * the user stops dragging for 400ms.
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== "undefined") {
  useOverridesStore.subscribe(() => {
    const next = computeSignature();
    if (next === useReflowStore.getState().signature) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      // Final check: only rebuild if signature still differs
      if (computeSignature() !== useReflowStore.getState().signature) {
        useReflowStore.getState().rebuild();
      }
    }, 400); // 400ms debounce — won't rebuild while slider is dragging
  });
}
