/**
 * Text Reflow Engine
 * ------------------
 * Handles dynamic text reflow across rows and pages in editor mode.
 * When text is added/modified in a row, overflow cascades to subsequent rows
 * and across page boundaries.
 *
 * PERFORMANCE NOTE: All text measurement uses Canvas API (canvasMeasure.ts)
 * instead of DOM-span offsetWidth to avoid Layout Thrashing.
 */

import type { FabricLine } from "@/components/studio/FabricLines";
import type { LocalOverride } from "@/state/overridesStore";
import { measureTextWidthCanvas, splitToFitCanvas, splitToFitForLayer } from "./canvasMeasure";


export type LayerKind = "arabic" | "bangla";

/** True if the given layer at (pageId, rowIndex) is in Area Text mode
 *  (independent frame — must be skipped by cascade/back-fill). */
function isAreaLayer(
  pageId: string,
  rowIndex: number,
  layer: LayerKind,
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pid: string, ri: number, l: LayerKind) => string,
): boolean {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  return localMap[lk]?.textMode === "area";
}

/**
 * Measures the rendered pixel width of `text`.
 * Uses Canvas API — no DOM reads, no Layout Thrashing.
 *
 * @deprecated Use measureTextWidthCanvas() from canvasMeasure.ts directly.
 * This wrapper is kept for backwards-compatibility with any callers.
 */
export function measureTextWidth(
  text: string,
  fontFamily: string,
  fontSize: number,
): number {
  return measureTextWidthCanvas(text, fontFamily, fontSize);
}

/**
 * Splits text to fit within maxWidth pixels using Canvas measurement.
 * Replaces the previous DOM-span based implementation.
 */
export function splitToFit(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
): { fits: string; overflow: string } {
  return splitToFitCanvas(text, maxWidth, fontFamily, fontSize);
}

/**
 * Gets effective text for a row+layer — uses local override text if set,
 * otherwise falls back to original page data.
 */
export function getEffectiveText(
  pageId: string,
  rowIndex: number,
  layer: LayerKind,
  lines: FabricLine[],
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pageId: string, rowIndex: number, layer: LayerKind) => string,
): string {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  const ov = localMap[lk];
  if (ov?.text !== undefined) return ov.text;
  return layer === "arabic"
    ? (lines[rowIndex]?.arabic ?? "")
    : (lines[rowIndex]?.bangla ?? "");
}

export type ReflowOptions = {
  startPageId: string;
  startRowIndex: number;
  startOverflow: string;
  layer: LayerKind;
  /** All pages in order — {id, lines}[] */
  allPages: Array<{ id: string; lines: FabricLine[] }>;
  localMap: Record<string, LocalOverride>;
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void;
  layerKeyFn: (pageId: string, rowIndex: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  /** If provided, reflow is constrained to these pageIds (e.g. one surah). */
  surahPageIds?: string[];
};


/**
 * Cascading reflow from a given row across the entire surah.
 * Accepts an overflow string and distributes it through subsequent rows/pages.
 * Uses Canvas measurement — no DOM reads.
 */
export function reflowFrom(opts: ReflowOptions): void {
  const {
    startPageId,
    startRowIndex,
    startOverflow,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  let overflow = startOverflow.trim();
  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return;

  // Iterate through pages starting from the given position
  for (let pi = startPageIdx; pi < targetPages.length && overflow !== ""; pi++) {
    const page = targetPages[pi];
    const firstRow = pi === startPageIdx ? startRowIndex : 0;

    for (let ri = firstRow; ri < page.lines.length; ri++) {
      // Skip Area-mode rows — independent frames don't participate in cascade.
      if (
        !(pi === startPageIdx && ri === startRowIndex) &&
        isAreaLayer(page.id, ri, layer, localMap, layerKeyFn)
      ) continue;
      const lk = layerKeyFn(page.id, ri, layer);
      // Get existing text for this row (only for rows after the start)
      const existingText =
        pi === startPageIdx && ri === startRowIndex
          ? "" // start row already has its new text set
          : getEffectiveText(page.id, ri, layer, page.lines, localMap, layerKeyFn);

      // Combine overflow with existing text
      const combined = existingText
        ? overflow + " " + existingText
        : overflow;

      const { fits, overflow: newOverflow } = splitToFitForLayer(
        combined,
        availableWidth,
        fontFamily,
        fontSize,
        layer,
      );


      patchLocal(lk, { text: fits });
      overflow = newOverflow.trim();

      if (overflow === "") break;
    }
  }
}

/**
 * Async version of reflowFrom for large cross-page cascades.
 * Yields to the browser between page batches (PAGES_PER_CHUNK pages per tick)
 * to avoid blocking the main thread. Sets isReflowing flag on reflowStore.
 */
const PAGES_PER_CHUNK = 3;
export async function reflowFromAsync(opts: ReflowOptions): Promise<void> {
  const {
    startPageId, startRowIndex, startOverflow, layer,
    allPages, localMap, patchLocal, layerKeyFn,
    fontFamily, fontSize, availableWidth, surahPageIds,
  } = opts;

  const { useReflowStore } = await import("@/state/reflowStore");
  useReflowStore.getState().setIsReflowing(true);

  try {
    let overflow = startOverflow.trim();
    const targetPages = surahPageIds
      ? allPages.filter((p) => surahPageIds.includes(p.id))
      : allPages;
    const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
    if (startPageIdx === -1) return;

    for (let pi = startPageIdx; pi < targetPages.length && overflow !== ""; pi++) {
      // Yield to browser between page chunks
      if ((pi - startPageIdx) % PAGES_PER_CHUNK === 0 && pi > startPageIdx) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      const page = targetPages[pi]!;
      const firstRow = pi === startPageIdx ? startRowIndex : 0;

      for (let ri = firstRow; ri < page.lines.length; ri++) {
        // Skip Area-mode rows — independent frames don't participate in cascade.
        if (
          !(pi === startPageIdx && ri === startRowIndex) &&
          isAreaLayer(page.id, ri, layer, localMap, layerKeyFn)
        ) continue;
        const lk = layerKeyFn(page.id, ri, layer);
        const existingText =
          pi === startPageIdx && ri === startRowIndex
            ? ""
            : getEffectiveText(page.id, ri, layer, page.lines, localMap, layerKeyFn);

        const combined = existingText ? overflow + " " + existingText : overflow;
        const { fits, overflow: newOverflow } = splitToFitForLayer(
          combined, availableWidth, fontFamily, fontSize, layer,
        );
        patchLocal(lk, { text: fits });
        overflow = newOverflow.trim();
        if (overflow === "") break;
      }
    }
  } finally {
    useReflowStore.getState().setIsReflowing(false);
  }
}


export type BackFillOptions = {
  startPageId: string;
  startRowIndex: number;
  layer: LayerKind;
  allPages: Array<{ id: string; lines: FabricLine[] }>;
  localMap: Record<string, LocalOverride>;
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void;
  layerKeyFn: (pid: string, ri: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  surahPageIds?: string[];
};

/**
 * Back-fill cascade: when a row has spare width, pull leading words from the
 * next row(s) to fill it. Continues forward until no more words can be pulled
 * or the end of the target page range is reached.
 *
 * Uses Canvas measurement only (no DOM reads). Mirrors `reflowFrom` style.
 */
export function backFillFrom(opts: BackFillOptions): void {
  const {
    startPageId,
    startRowIndex,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return;

  // Defensive: if start row itself is Area-mode, back-fill is a no-op.
  if (isAreaLayer(startPageId, startRowIndex, layer, localMap, layerKeyFn)) return;

  // In-memory text cache so iterative writes are visible without re-reading store.
  const textCache = new Map<string, string>();
  const readText = (pid: string, ri: number, lines: FabricLine[]): string => {
    const lk = layerKeyFn(pid, ri, layer);
    if (textCache.has(lk)) return textCache.get(lk)!;
    return getEffectiveText(pid, ri, layer, lines, localMap, layerKeyFn);
  };
  const writeText = (pid: string, ri: number, text: string) => {
    const lk = layerKeyFn(pid, ri, layer);
    textCache.set(lk, text);
    patchLocal(lk, { text });
  };

  let pi = startPageIdx;
  let ri = startRowIndex;

  const maxIterations = targetPages.length * 50 + 100;
  let iter = 0;

  while (iter++ < maxIterations) {
    const curPage = targetPages[pi];
    if (!curPage || ri >= curPage.lines.length) break;

    // Find next row (same page, else next page row 0).
    let nPi = pi;
    let nRi = ri + 1;
    if (nRi >= curPage.lines.length) {
      nPi = pi + 1;
      nRi = 0;
    }
    if (nPi >= targetPages.length) break;
    const nextPage = targetPages[nPi];
    if (!nextPage || nextPage.lines.length === 0) break;

    const curText = readText(curPage.id, ri, curPage.lines).trim();
    const nextText = readText(nextPage.id, nRi, nextPage.lines).trim();

    if (nextText === "") {
      // Empty next row — nothing to pull; advance to it and continue collapsing.
      pi = nPi;
      ri = nRi;
      continue;
    }

    const combined = curText ? curText + " " + nextText : nextText;
    const { fits, overflow } = splitToFitForLayer(
      combined,
      availableWidth,
      fontFamily,
      fontSize,
      layer,
    );


    // No extra word pulled — leading word of nextText doesn't fit. Stop.
    if (fits === curText) break;

    writeText(curPage.id, ri, fits);
    writeText(nextPage.id, nRi, overflow.trim());

    if (overflow.trim() === "") {
      // Next row fully drained — advance and try to pull from the row after.
      pi = nPi;
      ri = nRi;
      continue;
    }
    // Next row still has text but couldn't give more — done.
    break;
  }
}

export type CollapseBackwardOptions = BackFillOptions;

export function collapseLineBreakBackward(opts: CollapseBackwardOptions): {
  merged: boolean;
  crossesPage: boolean;
} {
  const {
    startPageId,
    startRowIndex,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return { merged: false, crossesPage: false };

  const currentPage = targetPages[startPageIdx];
  if (!currentPage) return { merged: false, crossesPage: false };

  let prevPageIdx = startPageIdx;
  let prevRowIdx = startRowIndex - 1;
  if (prevRowIdx < 0) {
    prevPageIdx = startPageIdx - 1;
    if (prevPageIdx < 0) return { merged: false, crossesPage: false };
    prevRowIdx = (targetPages[prevPageIdx]?.lines.length ?? 0) - 1;
  }
  if (prevRowIdx < 0) return { merged: false, crossesPage: false };

  const prevPage = targetPages[prevPageIdx];
  if (!prevPage) return { merged: false, crossesPage: false };

  const prevText = getEffectiveText(prevPage.id, prevRowIdx, layer, prevPage.lines, localMap, layerKeyFn).trim();
  const currentText = getEffectiveText(startPageId, startRowIndex, layer, currentPage.lines, localMap, layerKeyFn).trim();
  if (!currentText) return { merged: false, crossesPage: prevPage.id !== startPageId };

  const combined = prevText ? `${prevText} ${currentText}` : currentText;
  const { fits, overflow } = splitToFitForLayer(
    combined,
    availableWidth,
    fontFamily,
    fontSize,
    layer,
  );

  patchLocal(layerKeyFn(prevPage.id, prevRowIdx, layer), { text: fits });
  patchLocal(layerKeyFn(startPageId, startRowIndex, layer), { text: "" });

  const remainder = overflow.trim();
  if (remainder) {
    reflowFrom({
      startPageId,
      startRowIndex,
      startOverflow: remainder,
      layer,
      allPages: targetPages,
      localMap: useOverridesStore.getState().local,
      patchLocal,
      layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });
  } else {
    backFillFrom({
      startPageId,
      startRowIndex,
      layer,
      allPages: targetPages,
      localMap: useOverridesStore.getState().local,
      patchLocal,
      layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });
  }

  return { merged: true, crossesPage: prevPage.id !== startPageId };
}

/**
 * Gets text before and after the cursor in a contenteditable element.
 */
export function getTextAroundCursor(el: HTMLElement): {
  before: string;
  after: string;
} {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { before: el.textContent ?? "", after: "" };
  }

  const range = sel.getRangeAt(0);

  // Range from start of element to cursor
  const beforeRange = document.createRange();
  try {
    beforeRange.setStart(el, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
  } catch {
    return { before: el.textContent ?? "", after: "" };
  }

  const before = beforeRange.toString();
  const full = el.textContent ?? "";
  const after = full.substring(before.length);

  return { before, after };
}


/* ─── planCascade — pure dry-run for cross-page reflow ──────────── */

export type CascadeRowUpdate = {
  pageId: string;
  rowIndex: number;
  layer: LayerKind;
  text: string;
};

export type CascadePlan = {
  rowUpdates: CascadeRowUpdate[];
  crossesPage: boolean;
  crossesSurah: boolean;
  affectedPages: number;
  /** Text that does not fit anywhere in the scoped pages (overflow tail). */
  tailOverflow: string;
};

export type PlanCascadeOptions = {
  startPageId: string;
  startRowIndex: number;
  /** What the start row should contain AFTER the edit. */
  newCurrentText: string;
  /** Text to flow into the row after `start`. May be empty. */
  pushedText: string;
  layer: LayerKind;
  /** All scoped pages in order. */
  allPages: Array<{ id: string; lines: FabricLine[] }>;
  localMap: Record<string, LocalOverride>;
  layerKeyFn: (pid: string, ri: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  /** PageIds belonging to the current surah (for crossesSurah detection). */
  surahPageIds?: string[];
};

/**
 * Pure dry-run: returns the diff of what reflow WOULD do, without mutating
 * any store. Lets the caller decide whether to confirm via a dialog.
 */
export function planCascade(opts: PlanCascadeOptions): CascadePlan {
  const {
    startPageId,
    startRowIndex,
    newCurrentText,
    pushedText,
    layer,
    allPages,
    localMap,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds,
  } = opts;

  const startPageIdx = allPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) {
    return {
      rowUpdates: [],
      crossesPage: false,
      crossesSurah: false,
      affectedPages: 0,
      tailOverflow: "",
    };
  }

  const updates: CascadeRowUpdate[] = [
    { pageId: startPageId, rowIndex: startRowIndex, layer, text: newCurrentText },
  ];

  let carry = pushedText.trim();
  const affectedPageIds = new Set<string>([startPageId]);

  // Walk forward through scoped pages, starting at the row AFTER startRow.
  let pi = startPageIdx;
  let ri = startRowIndex + 1;

  while (carry !== "" && pi < allPages.length) {
    const page = allPages[pi];
    if (!page) break;

    if (ri >= page.lines.length) {
      pi += 1;
      ri = 0;
      continue;
    }

    const existing = getEffectiveText(
      page.id,
      ri,
      layer,
      page.lines,
      localMap,
      layerKeyFn,
    );
    const combined = existing ? carry + " " + existing : carry;
    const { fits, overflow } = splitToFitForLayer(
      combined,
      availableWidth,
      fontFamily,
      fontSize,
      layer,
    );


    if (fits !== existing) {
      updates.push({ pageId: page.id, rowIndex: ri, layer, text: fits });
      affectedPageIds.add(page.id);
    }
    carry = overflow.trim();
    ri += 1;
  }

  const crossesPage = Array.from(affectedPageIds).some((pid) => pid !== startPageId);
  let crossesSurah = false;
  if (surahPageIds && surahPageIds.length > 0) {
    crossesSurah = Array.from(affectedPageIds).some((pid) => !surahPageIds.includes(pid));
  }

  return {
    rowUpdates: updates,
    crossesPage,
    crossesSurah,
    affectedPages: affectedPageIds.size,
    tailOverflow: carry,
  };
}

/* ─── reflowLayerText — single unified entry point ──────────────── */

import { effectiveReflowScope, type ReflowLayer } from "./reflowScope";
import { useOverridesStore, layerKey as _layerKeyFn } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { useEditorStore, type SelectionScope } from "@/state/editorStore";

export type ReflowLayerTextResult = {
  /** Link OFF + overflow exists → caller should toast/clip. */
  clipped: boolean;
  /** Did we end up modifying any other row? */
  cascaded: boolean;
  /** crossesPage flag from planCascade (only meaningful when cascaded). */
  crossesPage: boolean;
  crossesSurah: boolean;
};

export type ReflowLayerTextOptions = {
  pageId: string;
  rowIndex: number;
  layer: ReflowLayer;
  reason: "text-edit" | "typography" | "paste";
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  /** Editor scope at trigger time. Defaults to current editor scope. */
  scope?: SelectionScope;
};

/**
 * Unified reflow trigger used by both typography changes and (eventually) the
 * inline editor. Resolves layer-aware effective scope, runs the cascade walk,
 * and either applies it directly or stages it on `editorStore.pendingReflow`
 * for the `CrossPageReflowDialog` to confirm.
 *
 * Returns synchronously with metadata so the caller can show a toast when
 * `clipped === true` (link OFF + overflow).
 */
export function reflowLayerText(opts: ReflowLayerTextOptions): ReflowLayerTextResult {
  const {
    pageId,
    rowIndex,
    layer,
    fontFamily,
    fontSize,
    availableWidth,
  } = opts;

  const editorState = useEditorStore.getState();
  if (opts.scope === undefined && typeof console !== "undefined") {
    // Callers should always pass scope explicitly to avoid races against
    // user-driven scope changes between the trigger and the reflow walk.
    // eslint-disable-next-line no-console
    console.warn("[reflowLayerText] called without scope; falling back to editor state");
  }
  const scope = opts.scope ?? editorState.scope;
  const eff = effectiveReflowScope(scope, layer, pageId);


  const reflowState = useReflowStore.getState();
  const pages = reflowState.pages as unknown as Array<{ id: string; lines: FabricLine[] }>;
  const localMap = useOverridesStore.getState().local;
  const patchLocal = useOverridesStore.getState().patchLocal;

  const startPage = pages.find((p) => p.id === pageId);
  if (!startPage) {
    return { clipped: false, cascaded: false, crossesPage: false, crossesSurah: false };
  }

  const currentText = getEffectiveText(
    pageId,
    rowIndex,
    layer,
    startPage.lines,
    localMap,
    _layerKeyFn,
  );

  const { fits, overflow } = splitToFitForLayer(
    currentText,
    availableWidth,
    fontFamily,
    fontSize,
    layer,
  );

  // Link OFF — never spill into other rows.
  if (!eff.cascade) {
    if (overflow.trim() === "") {
      return { clipped: false, cascaded: false, crossesPage: false, crossesSurah: false };
    }
    // Clip to the current row; caller surfaces a toast.
    patchLocal(_layerKeyFn(pageId, rowIndex, layer), { text: fits });
    return { clipped: true, cascaded: false, crossesPage: false, crossesSurah: false };
  }

  const scopedPages = pages.filter((p) => eff.pageIds.includes(p.id));
  const surahPageIds = eff.pageIds;

  if (overflow.trim() !== "") {
    // Dry-run to detect crossing.
    const plan = planCascade({
      startPageId: pageId,
      startRowIndex: rowIndex,
      newCurrentText: fits,
      pushedText: overflow.trim(),
      layer,
      allPages: scopedPages,
      localMap,
      layerKeyFn: _layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });

    const apply = () => {
      patchLocal(_layerKeyFn(pageId, rowIndex, layer), { text: fits });
      void reflowFromAsync({
        startPageId: pageId,
        startRowIndex: rowIndex + 1,
        startOverflow: overflow.trim(),
        layer,
        allPages: scopedPages,
        localMap: useOverridesStore.getState().local,
        patchLocal,
        layerKeyFn: _layerKeyFn,
        fontFamily,
        fontSize,
        availableWidth,
        surahPageIds,
      });
    };

    if (plan.crossesPage || plan.crossesSurah) {
      editorState.setPendingReflow({
        crossesPage: plan.crossesPage,
        crossesSurah: plan.crossesSurah,
        affectedPages: plan.affectedPages,
        confirm: apply,
      });
      return {
        clipped: false,
        cascaded: true,
        crossesPage: plan.crossesPage,
        crossesSurah: plan.crossesSurah,
      };
    }

    apply();
    return { clipped: false, cascaded: true, crossesPage: false, crossesSurah: false };
  }

  // No overflow → try a back-fill if there is slack.
  const currentWidth = measureTextWidthCanvas(currentText, fontFamily, fontSize);
  if (currentWidth < availableWidth - 20) {
    backFillFrom({
      startPageId: pageId,
      startRowIndex: rowIndex,
      layer,
      allPages: scopedPages,
      localMap,
      patchLocal,
      layerKeyFn: _layerKeyFn,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds,
    });
    return { clipped: false, cascaded: true, crossesPage: false, crossesSurah: false };
  }

  return { clipped: false, cascaded: false, crossesPage: false, crossesSurah: false };
}

