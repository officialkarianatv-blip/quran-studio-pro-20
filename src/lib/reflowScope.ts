/**
 * Reflow Scope Resolver
 * ---------------------
 * Single source of truth for "which rows/pages should this text reflow walk?".
 *
 * Combines:
 *   - per-layer Linking switch (`useLinkingStore`)
 *   - editor scope picker (general | page | surah | global)
 *   - reflow distribution (page → surah mapping)
 *
 * Linking OFF for the layer → cascade=false (caller must NOT touch other rows).
 * Linking ON  → cascade=true, pageIds resolved from scope.
 *
 * Symbol layer has no text reflow — callers should not invoke this for "symbol".
 */
import type { SelectionScope } from "@/state/editorStore";
import { useLinkingStore } from "@/state/linkingStore";
import { useReflowStore } from "@/state/reflowStore";

export type ReflowLayer = "arabic" | "bangla";

export type ReflowScopeResult = {
  /** false → only the current row may be touched (link OFF). */
  cascade: boolean;
  /** Pages the reflow walk is allowed to traverse. */
  pageIds: string[];
  layer: ReflowLayer;
};

/**
 * Resolve the effective reflow scope for a (scope, layer, currentPage) tuple.
 * Pure function — reads stores synchronously via getState().
 */
export function effectiveReflowScope(
  scope: SelectionScope,
  layer: ReflowLayer,
  pageId: string,
): ReflowScopeResult {
  const linked = useLinkingStore.getState()[layer];
  if (!linked) {
    return { cascade: false, pageIds: [pageId], layer };
  }

  const { pages, distribution } = useReflowStore.getState();

  if (scope === "general" || scope === "page") {
    return { cascade: true, pageIds: [pageId], layer };
  }

  if (scope === "surah") {
    const srcSurah = distribution.find((d) => d.pageId === pageId)?.surah ?? 0;
    const ids =
      srcSurah > 0
        ? distribution.filter((d) => d.surah === srcSurah).map((d) => d.pageId)
        : [pageId];
    return { cascade: true, pageIds: ids, layer };
  }

  // global
  return { cascade: true, pageIds: pages.map((p) => p.id), layer };
}
