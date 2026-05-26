/**
 * ElectronDAL — talks to the Electron main process over the
 * window.electronAPI bridge defined in electron/preload.cjs.
 *
 * Selected automatically by src/data/dal.ts when window.electronAPI exists.
 */

import type { QuranDAL } from "@/data/dal";
import type { PageData } from "@/data/pages";
import type { Verse as FlowVerse } from "@/lib/quranLayout";

type ElectronAPI = {
  isElectron: true;
  loadVerses(surah?: number): Promise<FlowVerse[]>;
  getPage(pageId: string): Promise<PageData | null>;
  getPageRange(from: number, to: number): Promise<PageData[]>;
  getSurahPages(surahNo: number): Promise<PageData[]>;
  getTotalPages(): Promise<number>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export class ElectronDAL implements QuranDAL {
  private api: ElectronAPI;
  private versesCache: FlowVerse[] | null = null;

  constructor(api: ElectronAPI) {
    this.api = api;
  }

  async loadVerses(surah?: number): Promise<FlowVerse[]> {
    if (surah !== undefined) return this.api.loadVerses(surah);
    if (!this.versesCache) this.versesCache = await this.api.loadVerses();
    return this.versesCache;
  }

  getPage(pageId: string): Promise<PageData | null> {
    return this.api.getPage(pageId);
  }

  getPageRange(from: number, to: number): Promise<PageData[]> {
    return this.api.getPageRange(from, to);
  }

  getSurahPages(surahNo: number): Promise<PageData[]> {
    return this.api.getSurahPages(surahNo);
  }

  getTotalPages(): Promise<number> {
    return this.api.getTotalPages();
  }
}
