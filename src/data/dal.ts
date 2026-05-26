/**
 * Data Access Layer (DAL) — Browser / Electron abstraction
 * ---------------------------------------------------------
 * This interface decouples the application from its data source.
 * Currently (browser): implemented with JSON file imports.
 * Future (Electron):   implemented with SQLite via better-sqlite3 / Prisma.
 *
 * Switching data backends requires only implementing this interface —
 * no changes needed in UI components or stores.
 */

import type { PageData } from "@/data/pages";
import type { Verse as FlowVerse } from "@/lib/quranLayout";

export interface QuranDAL {
  /**
   * Load all verses. May return cached data on subsequent calls.
   * Browser: imports verses.json (~5.6 MB).
   * Electron: queries SQLite `verses` table.
   */
  loadVerses(surah?: number): Promise<FlowVerse[]>;

  /**
   * Get a single page by ID.
   * Browser: filter from in-memory pages array.
   * Electron: SELECT * FROM pages WHERE id = ?
   */
  getPage(pageId: string): Promise<PageData | null>;

  /**
   * Get a range of pages by page numbers (1-indexed).
   * Useful for virtualized loading — only fetch what's visible.
   * Browser: slice from pre-built pages array.
   * Electron: SELECT * FROM pages WHERE page_no BETWEEN ? AND ?
   */
  getPageRange(fromPageNo: number, toPageNo: number): Promise<PageData[]>;

  /**
   * Get all pages for a surah.
   * Browser: filter from pre-built pages array.
   * Electron: SELECT * FROM pages WHERE surah = ?
   */
  getSurahPages(surahNo: number): Promise<PageData[]>;

  /**
   * Total page count.
   */
  getTotalPages(): Promise<number>;
}

/**
 * Browser implementation — uses the existing JSON-based data pipeline.
 * This is the current production implementation.
 */
export class BrowserDAL implements QuranDAL {
  private versesCache: FlowVerse[] | null = null;
  private pagesCache: PageData[] | null = null;

  async loadVerses(surah?: number): Promise<FlowVerse[]> {
    if (!this.versesCache) {
      const { loadAllVerses } = await import("@/data/pages");
      this.versesCache = await loadAllVerses() as unknown as FlowVerse[];
    }
    if (surah !== undefined) {
      return this.versesCache.filter((v) => v.s === surah);
    }
    return this.versesCache;
  }

  async getPage(pageId: string): Promise<PageData | null> {
    const pages = await this.getAllPages();
    return pages.find((p) => p.id === pageId) ?? null;
  }

  async getPageRange(fromPageNo: number, toPageNo: number): Promise<PageData[]> {
    const pages = await this.getAllPages();
    return pages.filter((p) => {
      const no = Number(String(p.footer.pageNo).replace(/[০-৯]/g, (c) =>
        String("০১২৩৪৫৬৭৮৯".indexOf(c))
      ));
      return no >= fromPageNo && no <= toPageNo;
    });
  }

  async getSurahPages(surahNo: number): Promise<PageData[]> {
    const { useReflowStore } = await import("@/state/reflowStore");
    const { pages, distribution } = useReflowStore.getState();
    const surahPageIds = new Set(
      distribution.filter((d) => d.surah === surahNo).map((d) => d.pageId)
    );
    return pages.filter((p) => surahPageIds.has(p.id));
  }

  async getTotalPages(): Promise<number> {
    const pages = await this.getAllPages();
    return pages.length;
  }

  private async getAllPages(): Promise<PageData[]> {
    if (this.pagesCache) return this.pagesCache;
    const { buildAllPages, loadAllVerses } = await import("@/data/pages");
    await loadAllVerses();
    this.pagesCache = buildAllPages();
    return this.pagesCache;
  }
}

/**
 * Singleton DAL instance — auto-selects ElectronDAL when running inside
 * Electron (preload.cjs exposed window.electronAPI), otherwise BrowserDAL.
 *
 * Usage:
 *   import { dal } from "@/data/dal";
 *   const page = await dal.getPage("vpage-1");
 */
function pickDAL(): QuranDAL {
  if (typeof window !== "undefined" && (window as any).electronAPI?.isElectron) {
    // Lazy require keeps Electron-only types out of the SSR / Worker bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ElectronDAL } = require("./dal.electron") as typeof import("./dal.electron");
    return new ElectronDAL((window as any).electronAPI);
  }
  return new BrowserDAL();
}

export const dal: QuranDAL = pickDAL();
