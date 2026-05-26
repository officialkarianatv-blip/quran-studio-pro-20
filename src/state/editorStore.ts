import { create } from "zustand";

export type SelectionKind = "row" | "word" | "symbol" | "layer";
export type ActiveTool = "select" | "type";

/** Which sub-layer of a row is active in Type Tool mode */
export type ActiveLayerKind = "arabic" | "bangla" | "symbol" | null;

/** Scope determines which elements are affected by overrides.
 *  general = only the single selected element (default)
 *  page    = all same-kind elements within the current page
 *  surah   = all same-kind elements within the current surah
 *  global  = all same-kind elements across every page
 */
export type SelectionScope = "general" | "page" | "surah" | "global";

export type Selection = {
  kind: SelectionKind;
  key: string;
  pageId: string;
  rowIndex: number;
  /** For layer-kind: which sub-layer (arabic/bangla/symbol) */
  layerKind?: ActiveLayerKind;
  wordIndex?: number;
  symbolKey?: string;
  surahNum?: number;
  paraNum?: number;
};

/** Back-compat alias */
export type Scope = "global" | "local";

/** Pending cross-page reflow plan awaiting user confirmation. */
export type PendingReflow = {
  crossesPage: boolean;
  crossesSurah: boolean;
  affectedPages: number;
  /** Apply the reflow. Mounted dialog calls this on "হ্যাঁ". */
  confirm: () => void;
  /** Optional rollback if the user cancels. */
  cancel?: () => void;
};

type EditorState = {
  editMode: boolean;
  activeTool: ActiveTool;
  scope: SelectionScope;
  legacyScope: Scope;
  selection: Selection | null;
  hover: Selection | null;
  showGuides: boolean;
  snapToGrid: boolean;
  layerPanelOpen: boolean;
  /** Page currently shown on the canvas (single source of truth). */
  activePageId: string | null;
  /** @deprecated Legacy signal; prefer activePageId. Cleared after Workspace consumes. */
  navigateToPageId: string | null;
  /** Row key to flash for ~1.2s after navigation */
  focusedRowKey: string | null;
  /** Set of surah numbers currently expanded in the sidebar */
  expandedSurahs: Set<number>;
  pendingReflow: PendingReflow | null;
  setPendingReflow: (p: PendingReflow | null) => void;
  /** Current artboard zoom (0–3 range, 1.0 = 100%). Synced from Workspace. */
  zoom: number;
  setZoom: (v: number) => void;
  toggleSurah: (n: number) => void;
  expandSurah: (n: number) => void;
  setEditMode: (v: boolean) => void;
  toggleEditMode: () => void;
  setActiveTool: (t: ActiveTool) => void;
  setScope: (s: SelectionScope) => void;
  setSelection: (s: Selection | null) => void;
  setHover: (s: Selection | null) => void;
  setShowGuides: (v: boolean) => void;
  setSnapToGrid: (v: boolean) => void;
  setLayerPanelOpen: (v: boolean) => void;
  toggleLayerPanel: () => void;
  setActivePageId: (pageId: string | null) => void;
  /** Navigate to a page and optionally flash a row for ~1.2s */
  navigateTo: (pageId: string, rowKey?: string) => void;
  clearFocusedRow: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  editMode: false,
  activeTool: "select",
  scope: "general",
  legacyScope: "local",

  selection: null,
  hover: null,
  showGuides: false,
  snapToGrid: false,
  layerPanelOpen: false,
  activePageId: null,
  navigateToPageId: null,
  focusedRowKey: null,
  expandedSurahs: new Set<number>(),
  pendingReflow: null,
  setPendingReflow: (p) => set({ pendingReflow: p }),
  zoom: 1.0,
  setZoom: (v) => set({ zoom: v }),

  toggleSurah: (n) =>
    set((s) => {
      const next = new Set(s.expandedSurahs);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return { expandedSurahs: next };
    }),
  expandSurah: (n) =>
    set((s) => {
      if (s.expandedSurahs.has(n)) return {};
      const next = new Set(s.expandedSurahs);
      next.add(n);
      return { expandedSurahs: next };
    }),

  setEditMode: (v) => set({ editMode: v, selection: null, activeTool: "select" }),
  toggleEditMode: () =>
    set((s) => ({
      editMode: !s.editMode,
      selection: null,
      activeTool: "select",
      layerPanelOpen: !s.editMode ? s.layerPanelOpen : false,
    })),

  setActiveTool: (t) => set({ activeTool: t }),

  setScope: (scope) =>
    set({
      scope,
      legacyScope: scope === "global" ? "global" : "local",
    }),
  setSelection: (s) =>
    set((prev) => ({
      selection: s,
      layerPanelOpen: s !== null ? true : prev.layerPanelOpen,
    })),
  setHover: (s) => set({ hover: s }),
  setShowGuides: (v) => set({ showGuides: v }),
  setSnapToGrid: (v) => set({ snapToGrid: v }),
  setLayerPanelOpen: (v) => set({ layerPanelOpen: v }),
  toggleLayerPanel: () => set((s) => ({ layerPanelOpen: !s.layerPanelOpen })),

  setActivePageId: (pageId) => set({ activePageId: pageId }),

  navigateTo: (pageId, rowKey) => {
    set({
      activePageId: pageId,
      navigateToPageId: pageId,
      focusedRowKey: rowKey ?? null,
    });
    if (rowKey) {
      setTimeout(() => {
        useEditorStore.getState().clearFocusedRow();
      }, 1200);
    }
  },
  clearFocusedRow: () => set({ focusedRowKey: null }),
}));

