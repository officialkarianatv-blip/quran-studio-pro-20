// HTML/CSS renderer for the 9 Quran rows.
// Each row is an absolutely positioned box mapped to a physical SVG band so
// Arabic shaping is handled by the browser's text engine (correct ligatures,
// RTL bidi) and the text is strictly confined inside its template band.

import { memo, useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { TopSymbolLayer } from "./TopSymbolLayer";
import {
  useOverridesStore,
  rowKey,
  layerKey,
  wordLayerKey,
  MASTER_DEFAULTS,
  type LocalOverride,
} from "@/state/overridesStore";
import { useEditorStore } from "@/state/editorStore";
import { useReflowStore } from "@/state/reflowStore";
import {
  splitToFit,
  reflowFrom,
  reflowFromAsync,
  backFillFrom,
  collapseLineBreakBackward,
  measureTextWidth,
  getTextAroundCursor,
  planCascade,
  type LayerKind,
} from "@/lib/textReflow";
import { effectiveReflowScope } from "@/lib/reflowScope";
import { splitArabicWords } from "@/lib/wordSplit";
import { useLargeChangeGuard } from "@/hooks/useLargeChangeGuard";
import { ScopeImpactWarningDialog } from "./ScopeImpactWarningDialog";
import { toast } from "sonner";



export type FabricLine = {
  arabic?: string;
  bangla?: string;
  symbol?: string;
};

export type RowBox = {
  sy: number;
  ay: number;
  by: number;
  symH: number;
  arH: number;
  bnH: number;
};

type Props = {
  width: number;
  height: number;
  layout: RowBox[];
  lines: FabricLine[];
  arabicFamily: string;
  banglaFamily?: string;
  skip?: number;
  skipSlots?: number[];
};

export const ARABIC_FONT_PX = 40;
export const BANGLA_FONT_PX = 18;
export const SYMBOL_FONT_PX = 28;

/**
 * Baked-in baseline Y-offsets for the master Kariana template.
 */
export const BASE_ARABIC_Y = -15;
export const BASE_BANGLA_Y = 2;
export const BASE_SYMBOL_Y = -2;

type GlobalLayoutValues = {
  gArabic: number;
  gBangla: number;
  gArabicY: number;
  gBanglaY: number;
  gSymbolY: number;
};

const useGlobalLayoutValues = (): GlobalLayoutValues =>
  useOverridesStore(
    useShallow((s) => ({
      gArabic: s.global.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      gBangla: s.global.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      gArabicY: BASE_ARABIC_Y + (s.global.arabicYOffset ?? 0),
      gBanglaY: BASE_BANGLA_Y + (s.global.banglaYOffset ?? 0),
      gSymbolY: BASE_SYMBOL_Y + (s.global.symbolYOffset ?? 0),
    })),
  );

export const FabricLines = memo(function FabricLines({
  width,
  height,
  layout,
  lines,
  arabicFamily,
  banglaFamily = "'Kalpurush', 'Noto Serif Bengali', serif",
  skipSlots,
  pageId = "page",
}: Props & { pageId?: string }) {
  const skipSet = new Set(skipSlots ?? []);
  const editMode = useEditorStore((s) => s.editMode);

  return (
    <div style={{ position: "relative", width, height, pointerEvents: editMode ? "auto" : "none" }}>
      {layout.map((L, i) => {
        if (skipSet.has(i)) return null;
        const slot = lines[i];
        if (!slot) return null;
        return (
          <FabricRow
            key={`row-${i}`}
            pageId={pageId}
            rowIndex={i}
            box={L}
            slot={slot}
            width={width}
            arabicFamily={arabicFamily}
            banglaFamily={banglaFamily}
            lines={lines}
          />
        );
      })}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// FabricRow — one row, isolated via fine-grained selectors
// ──────────────────────────────────────────────────────────────────────────────
type FabricRowProps = {
  pageId: string;
  rowIndex: number;
  box: RowBox;
  slot: FabricLine;
  width: number;
  arabicFamily: string;
  banglaFamily: string;
  lines: FabricLine[];
};

const FabricRow = memo(function FabricRow({
  pageId,
  rowIndex: i,
  box: L,
  slot,
  width,
  arabicFamily,
  banglaFamily,
  lines,
}: FabricRowProps) {
  const rk = rowKey(pageId, i);
  const aLk = layerKey(pageId, i, "arabic");
  const bLk = layerKey(pageId, i, "bangla");
  const sLk = layerKey(pageId, i, "symbol");

  const { gArabic, gBangla, gArabicY, gBanglaY, gSymbolY } = useGlobalLayoutValues();

  // Fine-grained: only re-render when this row's four keys change
  const { rOv, aOv, bOv, sOv } = useOverridesStore(
    useShallow((s) => ({
      rOv: s.local[rk],
      aOv: s.local[aLk],
      bOv: s.local[bLk],
      sOv: s.local[sLk],
    })),
  );

  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const patchScopedAsync = useCallback((key: string, patch: Partial<LocalOverride>, scope: "general" | "page" | "surah" | "global") => {
    void (async () => {
      const { effectiveScope, patchScoped } = await import("@/state/overridesStore");
      const eff = await effectiveScope(scope, key.endsWith(":arabic") ? "arabic" : key.endsWith(":bangla") ? "bangla" : "symbol");
      await patchScoped(key, patch, eff);
    })();
  }, []);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectionKey = useEditorStore((s) => s.selection?.key);
  const selectionPageId = useEditorStore((s) => s.selection?.pageId);
  const focusedRowKey = useEditorStore((s) => s.focusedRowKey);
  const isTypeTool = editMode && activeTool === "type";
  const isSelectTool = editMode && activeTool === "select";

  // Per-layer drag state (not React state — avoids re-render during drag)
  const dragRef = useRef<{
    layer: "arabic" | "bangla" | "symbol";
    startX: number;
    startY: number;
    initDx: number;
    initDy: number;
    pointerId: number;
  } | null>(null);

  const arabicSpanRef = useRef<HTMLSpanElement | null>(null);

  const rowFontPx = rOv?.fontPx ?? gArabic;
  const rowScale = rOv?.scale ?? 1;
  const rowTx = rOv?.dx ?? 0;
  const rowTy = rOv?.dy ?? 0;
  const rowSymbolPx = Math.round((rowFontPx / ARABIC_FONT_PX) * SYMBOL_FONT_PX);

  const lkSy = sLk;
  const isFlashing =
    focusedRowKey === rk ||
    focusedRowKey === aLk ||
    focusedRowKey === bLk ||
    focusedRowKey === lkSy;

  // Arabic layer
  const aDx = aOv?.dx ?? 0;
  const aDy = aOv?.dy ?? 0;
  const aFontPx = aOv?.fontPx ?? rowFontPx;
  const aLeading = aOv?.leading ?? 1;
  const aTracking = aOv?.tracking ?? 0;
  const aVScale = (aOv?.vScale ?? 100) / 100;
  const aHScale = (aOv?.hScale ?? 100) / 100;
  const aScaleFactor = aFontPx / (gArabic || ARABIC_FONT_PX);
  const aBaseline = (aOv?.baseline ?? 0) * aScaleFactor;
  const aLineHeight = Math.max(1, aLeading * aScaleFactor);
  const aAlign = (aOv?.align ?? "justify") as React.CSSProperties["textAlign"];
  const aText = aOv?.text ?? slot.arabic ?? "";
  const isArabicEditing = isTypeTool && selectionKey === aLk && selectionPageId === pageId;

  // Bangla layer
  const bDx = bOv?.dx ?? 0;
  const bDy = bOv?.dy ?? 0;
  const bFontPx = bOv?.fontPx ?? gBangla;
  const bLeading = bOv?.leading ?? 1.1;
  const bTracking = bOv?.tracking ?? 0;
  const bVScale = (bOv?.vScale ?? 100) / 100;
  const bHScale = (bOv?.hScale ?? 100) / 100;
  const bScaleFactor = bFontPx / (gBangla || BANGLA_FONT_PX);
  const bBaseline = (bOv?.baseline ?? 0) * bScaleFactor;
  const bLineHeight = Math.max(1, bLeading * bScaleFactor);
  const bAlign = (bOv?.align ?? "justify") as React.CSSProperties["textAlign"];
  const bText = bOv?.text ?? slot.bangla ?? "";
  const isBanglaEditing = isTypeTool && selectionKey === bLk && selectionPageId === pageId;

  const sDx = sOv?.dx ?? 0;
  const sDy = sOv?.dy ?? 0;
  const sText = sOv?.text ?? slot.symbol ?? "";
  const isSymbolEditing = isTypeTool && selectionKey === sLk && selectionPageId === pageId;

  return (
    <div
      data-sel-kind="row"
      data-sel-key={rk}
      data-page-id={pageId}
      data-row-index={i}
      style={{
        position: "absolute",
        left: 0,
        top: L.sy,
        width,
        height: L.symH + L.arH + L.bnH,
        overflow: "visible",
        transform: `translate(${rowTx}px, ${rowTy}px) scale(${rowScale})`,
        transformOrigin: "top left",
        outline: isFlashing ? "2px solid rgba(251,191,36,0.85)" : undefined,
        outlineOffset: isFlashing ? "2px" : undefined,
        borderRadius: isFlashing ? "3px" : undefined,
        animation: isFlashing ? "rowFlash 1.1s ease-out" : undefined,
      }}
    >
      {/* Symbol strip */}
      <div
        data-sel-kind={editMode ? "layer" : undefined}
        data-sel-key={editMode ? sLk : undefined}
        data-layer-kind="symbol"
        onClick={
          isTypeTool
            ? (e) => {
                e.stopPropagation();
                useEditorStore.getState().setSelection({
                  kind: "layer",
                  key: sLk,
                  pageId,
                  rowIndex: i,
                  layerKind: "symbol",
                });
              }
            : undefined
        }
        onPointerDown={
          isSelectTool
            ? (e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = {
                  layer: "symbol",
                  startX: e.clientX,
                  startY: e.clientY,
                  initDx: sDx,
                  initDy: sDy,
                  pointerId: e.pointerId,
                };
                useEditorStore.getState().setSelection({
                  kind: "layer", key: sLk, pageId, rowIndex: i, layerKind: "symbol",
                });
              }
            : undefined
        }
        onPointerMove={
          isSelectTool
            ? (e) => {
                const d = dragRef.current;
                if (!d || d.layer !== "symbol") return;
                const zoomScale = useEditorStore.getState().zoom || 1;
                const dx = Math.round(d.initDx + (e.clientX - d.startX) / zoomScale);
                const dy = Math.round(d.initDy + (e.clientY - d.startY) / zoomScale);
                const scope = useEditorStore.getState().scope;
                if (scope === "general") patchLocal(sLk, { dx, dy });
                else patchScopedAsync(sLk, { dx, dy }, scope);
              }
            : undefined
        }
        onPointerUp={
          isSelectTool
            ? () => { dragRef.current = null; }
            : undefined
        }
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height: L.symH,
          transform: `translate(${sDx}px, ${gSymbolY + sDy}px)`,
          overflow: "visible",
          zIndex: 20,
          pointerEvents: isTypeTool || isSelectTool ? "auto" : "none",
          cursor: isSymbolEditing ? "text" : isSelectTool ? "grab" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isSymbolEditing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            dir="ltr"
            lang="ar"
            spellCheck={false}
            onBlur={(e) => patchLocal(sLk, { text: e.currentTarget.textContent ?? "" })}
            onInput={(e) => patchLocal(sLk, { text: e.currentTarget.textContent ?? "" })}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              display: "block",
              width: "100%",
              minHeight: "1em",
              outline: "2px solid rgba(56,189,248,0.7)",
              outlineOffset: "2px",
              borderRadius: "2px",
              background: "rgba(56,189,248,0.06)",
              textAlign: "center",
              fontSize: rowSymbolPx,
              lineHeight: `${Math.max(12, L.symH)}px`,
              color: "#ef4444",
            }}
          >
            {sText}
          </div>
        ) : sOv?.text !== undefined ? (
          <span
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              fontSize: rowSymbolPx,
              lineHeight: `${Math.max(12, L.symH)}px`,
              color: "#ef4444",
            }}
          >
            {sText}
          </span>
        ) : (
          (aText || slot.arabic) && (
            <TopSymbolLayer
              arabic={slot.arabic ?? aText}
              arabicSpanRef={arabicSpanRef}
              width={width}
              height={L.symH}
              fontFamily={arabicFamily}
              fontSize={rowSymbolPx}
              pageId={pageId}
              rowIndex={i}
              displayArabic={aText}
              isEditing={isArabicEditing}
            />
          )
        )}
      </div>

      {/* Arabic band */}
      <div
        dir="rtl"
        lang="ar"
        data-sel-kind={editMode ? "layer" : undefined}
        data-sel-key={editMode ? aLk : undefined}
        data-layer-kind="arabic"
        onClick={
          isTypeTool
            ? (e) => {
                e.stopPropagation();
                useEditorStore.getState().setSelection({
                  kind: "layer",
                  key: aLk,
                  pageId,
                  rowIndex: i,
                  layerKind: "arabic",
                });
              }
            : undefined
        }
        onPointerDown={
          isSelectTool
            ? (e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = {
                  layer: "arabic",
                  startX: e.clientX,
                  startY: e.clientY,
                  initDx: aDx,
                  initDy: aDy,
                  pointerId: e.pointerId,
                };
                useEditorStore.getState().setSelection({
                  kind: "layer", key: aLk, pageId, rowIndex: i, layerKind: "arabic",
                });
              }
            : undefined
        }
        onPointerMove={
          isSelectTool
            ? (e) => {
                const d = dragRef.current;
                if (!d || d.layer !== "arabic") return;
                const zoomScale = useEditorStore.getState().zoom || 1;
                const dx = Math.round(d.initDx + (e.clientX - d.startX) / zoomScale);
                const dy = Math.round(d.initDy + (e.clientY - d.startY) / zoomScale);
                const scope = useEditorStore.getState().scope;
                if (scope === "general") patchLocal(aLk, { dx, dy });
                else patchScopedAsync(aLk, { dx, dy }, scope);
              }
            : undefined
        }
        onPointerUp={
          isSelectTool
            ? () => { dragRef.current = null; }
            : undefined
        }

        style={{
          position: "absolute",
          left: 0,
          top: L.symH,
          width,
          height: L.arH,
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: "border-box",
          fontFamily: arabicFamily,
          fontSize: aFontPx,
          color: "#111827",
          lineHeight: aLineHeight,
          letterSpacing: aTracking,
          display: "block",
          paddingTop: Math.max(0, L.arH * 0.05),
          textAlign: aAlign,
          textAlignLast: aAlign === "justify" ? "justify" : undefined,
          whiteSpace: "nowrap",
          overflow: "visible",
          transform: `translate(${aDx}px, ${gArabicY + aBaseline + aDy}px) scaleX(${aHScale}) scaleY(${aVScale})`,
          transformOrigin: "top left",
          zIndex: 30,
          pointerEvents: isTypeTool || isSelectTool ? "auto" : "none",
          cursor: isArabicEditing ? "text" : isSelectTool ? "grab" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isArabicEditing ? (
          <InlineTextEditor
            key={aLk}
            layerKey={aLk}
            initialText={aText}
            dir="rtl"
            lang="ar"
            rowIndex={i}
            pageId={pageId}
            layer="arabic"
            lines={lines}
            fontFamily={arabicFamily}
            fontSize={aFontPx}
            availableWidth={width - 16}
            onSave={(t) => patchLocal(aLk, { text: t })}
          />
        ) : (
          slot.arabic && (
            <span
              ref={arabicSpanRef}
              style={{ display: "inline-block", width: "100%", textAlign: aAlign, textAlignLast: "justify" }}
            >
              <WordSpans
                text={aText}
                pageId={pageId}
                rowIndex={i}
                interactive={isTypeTool}
                fallbackFontPx={aFontPx}
                fallbackTracking={aTracking}
              />
            </span>
          )
        )}
      </div>

      {/* Bangla band */}
      <div
        lang="bn"
        data-sel-kind={editMode ? "layer" : undefined}
        data-sel-key={editMode ? bLk : undefined}
        data-layer-kind="bangla"
        onClick={
          isTypeTool
            ? (e) => {
                e.stopPropagation();
                useEditorStore.getState().setSelection({
                  kind: "layer",
                  key: bLk,
                  pageId,
                  rowIndex: i,
                  layerKind: "bangla",
                });
              }
            : undefined
        }
        onPointerDown={
          isSelectTool
            ? (e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = {
                  layer: "bangla",
                  startX: e.clientX,
                  startY: e.clientY,
                  initDx: bDx,
                  initDy: bDy,
                  pointerId: e.pointerId,
                };
                useEditorStore.getState().setSelection({
                  kind: "layer", key: bLk, pageId, rowIndex: i, layerKind: "bangla",
                });
              }
            : undefined
        }
        onPointerMove={
          isSelectTool
            ? (e) => {
                const d = dragRef.current;
                if (!d || d.layer !== "bangla") return;
                const zoomScale = useEditorStore.getState().zoom || 1;
                const dx = Math.round(d.initDx + (e.clientX - d.startX) / zoomScale);
                const dy = Math.round(d.initDy + (e.clientY - d.startY) / zoomScale);
                const scope = useEditorStore.getState().scope;
                if (scope === "general") patchLocal(bLk, { dx, dy });
                else patchScopedAsync(bLk, { dx, dy }, scope);
              }
            : undefined
        }
        onPointerUp={
          isSelectTool
            ? () => { dragRef.current = null; }
            : undefined
        }

        style={{
          position: "absolute",
          left: 0,
          top: L.symH + L.arH,
          width,
          height: L.bnH,
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: "border-box",
          fontFamily: banglaFamily,
          fontSize: bFontPx,
          color: "#064e3b",
          lineHeight: bLineHeight,
          letterSpacing: bTracking,
          overflow: "visible",
          display: "block",
          paddingTop: 1,
          textAlign: bAlign,
          textAlignLast: bAlign === "justify" ? "justify" : undefined,
          whiteSpace: "normal",
          transform: `translate(${bDx}px, ${gBanglaY + bBaseline + bDy}px) scaleX(${bHScale}) scaleY(${bVScale})`,
          transformOrigin: "top left",
          zIndex: 10,
          pointerEvents: isTypeTool || isSelectTool ? "auto" : "none",
          cursor: isBanglaEditing ? "text" : isSelectTool ? "grab" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isBanglaEditing ? (
          <InlineTextEditor
            key={bLk}
            layerKey={bLk}
            initialText={bText}
            dir="ltr"
            lang="bn"
            rowIndex={i}
            pageId={pageId}
            layer="bangla"
            lines={lines}
            fontFamily={banglaFamily}
            fontSize={bFontPx}
            availableWidth={width - 16}
            onSave={(t) => patchLocal(bLk, { text: t })}
          />
        ) : (
          slot.bangla && (
            <span style={{ display: "inline-block", width: "100%", textAlign: bAlign, textAlignLast: "justify" }}>
              {bText}
            </span>
          )
        )}
      </div>
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// InlineTextEditor — contenteditable with rAF-throttled overflow detection
// ──────────────────────────────────────────────────────────────────────────────
function InlineTextEditor({
  layerKey: lk,
  initialText,
  dir,
  lang,
  rowIndex,
  pageId,
  layer,
  lines,
  fontFamily,
  fontSize,
  availableWidth,
  onSave,
}: {
  layerKey: string;
  initialText: string;
  dir?: string;
  lang?: string;
  rowIndex: number;
  pageId: string;
  layer: LayerKind;
  lines: FabricLine[];
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  onSave: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>(initialText);
  const { request: requestGuarded, dialogProps: guardDialogProps } = useLargeChangeGuard();



  // Sync DOM ↔ store: on each keystroke, write text to store immediately
  // (no debounce — Zustand patches are cheap, and this guarantees the edit
  // never gets lost on selection-change/unmount races).
  const syncToStore = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";
    if (text === lastSavedRef.current) return;
    lastSavedRef.current = text;
    useOverridesStore.getState().patchLocal(lk, { text });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.textContent = initialText;
    lastSavedRef.current = initialText;
    el.focus();

    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        if (el.lastChild) range.setStartAfter(el.lastChild);
        else range.setStart(el, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch { /* ignore */ }

    return () => {
      // Flush any pending overflow-check synchronously before tearing down
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Always commit the current DOM text — covers unmount-without-blur
      const text = el.textContent ?? "";
      if (text !== lastSavedRef.current) {
        useOverridesStore.getState().patchLocal(lk, { text });
        lastSavedRef.current = text;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getReflowBase = () => {
    const editorScope = useEditorStore.getState().scope;
    const isReflowLayer = layer === "arabic" || layer === "bangla";
    const eff = isReflowLayer
      ? effectiveReflowScope(editorScope, layer as "arabic" | "bangla", pageId)
      : { cascade: true, pageIds: [pageId], layer: "arabic" as const };
    return {
      layer,
      cascade: eff.cascade,
      scopedPageIds: eff.pageIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allPages: useReflowStore.getState().pages as unknown as Array<{ id: string; lines: any[] }>,
      localMap: useOverridesStore.getState().local,
      patchLocal: useOverridesStore.getState().patchLocal,
      layerKeyFn: layerKey,
      fontFamily,
      fontSize,
      availableWidth,
      surahPageIds: eff.pageIds,
    };
  };



  const commit = (text?: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const finalText = text ?? ref.current?.textContent ?? "";
    if (finalText !== lastSavedRef.current) {
      lastSavedRef.current = finalText;
      onSave(finalText);
    }
  };

  // rAF-throttled overflow check — coalesces fast keystrokes into one frame
  const checkOverflow = () => {
    rafRef.current = null;
    const el = ref.current;
    if (!el) return;

    // Always sync current text first (covers normal typing)
    syncToStore();

    const currentText = el.textContent ?? "";
    const { fits, overflow } = splitToFit(currentText, availableWidth, fontFamily, fontSize);

    if (overflow) {
      const base = getReflowBase();

      // Link OFF for this layer → clip to current row, warn user, do not cascade.
      if (!base.cascade) {
        lastSavedRef.current = fits;
        useOverridesStore.getState().patchLocal(lk, { text: fits });
        el.textContent = fits;
        try {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            if (el.lastChild) range.setStartAfter(el.lastChild);
            else range.setStart(el, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch { /* ignore */ }
        toast.warning("লিংক বন্ধ — ওভারফ্লো অন্য সারিতে যাবে না", { id: `link-off-${lk}` });
        return;
      }

      // Cascade enabled — push overflow forward into subsequent rows.
      // Snapshot pre-edit text so cancel can restore it.
      const preEditText = lastSavedRef.current;

      lastSavedRef.current = fits;
      useOverridesStore.getState().patchLocal(lk, { text: fits });
      el.textContent = fits;
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          if (el.lastChild) range.setStartAfter(el.lastChild);
          else range.setStart(el, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch { /* ignore */ }

      const nextRowIdx = rowIndex + 1;
      const nextOnPage = nextRowIdx < lines.length;
      const targetPageId = nextOnPage
        ? pageId
        : (() => {
            const allPages = base.allPages;
            const pi = allPages.findIndex((p) => p.id === pageId);
            return pi >= 0 && pi + 1 < allPages.length ? allPages[pi + 1].id : pageId;
          })();
      const targetRowIdx = nextOnPage ? nextRowIdx : 0;

      // Strip non-reflow props before passing into reflowFrom.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cascade: _c, scopedPageIds: _s, ...reflowArgs } = base;

      const runReflow = () => {
        void reflowFromAsync({
          ...reflowArgs,
          startPageId: targetPageId,
          startRowIndex: targetRowIdx,
          startOverflow: overflow,
        });
      };

      // Dry-run to detect cross-page / cross-surah impact for confirmation.
      const scopedPageList = base.allPages.filter((p) =>
        base.scopedPageIds.includes(p.id),
      );
      const plan = planCascade({
        startPageId: targetPageId,
        startRowIndex: targetRowIdx,
        newCurrentText: "", // will be computed inside the cascade
        pushedText: overflow,
        layer,
        allPages: scopedPageList,
        localMap: base.localMap,
        layerKeyFn: base.layerKeyFn,
        fontFamily: base.fontFamily,
        fontSize: base.fontSize,
        availableWidth: base.availableWidth,
        surahPageIds: base.surahPageIds,
      });

      if (plan.crossesPage || plan.crossesSurah) {
        // Avoid stacking dialogs on rapid keystrokes.
        if (useEditorStore.getState().pendingReflow) return;
        useEditorStore.getState().setPendingReflow({
          crossesPage: plan.crossesPage,
          crossesSurah: plan.crossesSurah,
          affectedPages: plan.affectedPages,
          confirm: runReflow,
          cancel: () => {
            // Restore the start row to its pre-edit text (drop the typed
            // overflow words) so user can decide what to do next.
            useOverridesStore.getState().patchLocal(lk, { text: preEditText });
            lastSavedRef.current = preEditText;
            if (ref.current) ref.current.textContent = preEditText;
          },
        });
        return;
      }

      runReflow();
      return;
    }


    // Text fits — if there is spare room, try to back-fill from subsequent rows.
    const currentWidth = measureTextWidth(currentText, fontFamily, fontSize);
    if (currentWidth < availableWidth - 20) {
      const base = getReflowBase();
      if (!base.cascade) return; // link OFF → don't pull from other rows either
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cascade: _c, scopedPageIds: _s, ...reflowArgs } = base;
      backFillFrom({
        ...reflowArgs,
        startPageId: pageId,
        startRowIndex: rowIndex,
      });
    }

  };

  const handleInput = () => {
    if (rafRef.current != null) return; // already scheduled
    rafRef.current = requestAnimationFrame(checkOverflow);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.key === "Escape") {
      e.preventDefault();
      commit();
      useEditorStore.getState().setActiveTool("select");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;

      const { before, after } = getTextAroundCursor(el);
      const beforeText = before.trim();
      const afterText = after.trim();

      // Snapshot pre-edit text so cancel can restore it
      const preEditText = lastSavedRef.current;

      useOverridesStore.getState().patchLocal(lk, { text: beforeText });
      lastSavedRef.current = beforeText;
      el.textContent = beforeText;

      if (!afterText) return;

      const scope = useEditorStore.getState().scope;
      const base = getReflowBase();
      const allPages = base.allPages;

      // Link OFF for this layer → Enter cannot push text across rows.
      if (!base.cascade) {
        // Restore split text into a single line and warn.
        useOverridesStore.getState().patchLocal(lk, { text: `${beforeText} ${afterText}`.trim() });
        lastSavedRef.current = `${beforeText} ${afterText}`.trim();
        if (ref.current) ref.current.textContent = lastSavedRef.current;
        toast.warning("লিংক বন্ধ — Enter দিয়ে অন্য সারিতে যাবে না", { id: `link-off-enter-${lk}` });
        return;
      }


      // 1. Scope → target page IDs
      let scopePageIds: string[] | undefined;
      if (scope === "general" || scope === "page") {
        scopePageIds = [pageId];
      } else if (scope === "surah") {
        scopePageIds = base.surahPageIds ?? [pageId];
      } else {
        scopePageIds = undefined; // global → all
      }
      const scopedPageList = scopePageIds
        ? allPages.filter((p) => scopePageIds!.includes(p.id))
        : allPages;

      // 2. Resolve insertion point
      const nextRowIdx = rowIndex + 1;
      const nextOnPage = nextRowIdx < lines.length;
      let targetPageId = pageId;
      let targetRowIdx = nextRowIdx;
      if (!nextOnPage) {
        if (scope === "general" || scope === "page") return;
        const pi = allPages.findIndex((p) => p.id === pageId);
        const next = pi >= 0 && pi + 1 < allPages.length ? allPages[pi + 1] : undefined;
        if (!next) return;
        targetPageId = next.id;
        targetRowIdx = 0;
      }

      // 3. Combined overflow (afterText + existing text at target row)
      const tPage = allPages.find((p) => p.id === targetPageId);
      if (!tPage) return;
      const tLk = layerKey(targetPageId, targetRowIdx, layer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tRow: any = tPage.lines[targetRowIdx];
      const tRowFallback =
        layer === "arabic"
          ? (tRow?.arabicLine ?? tRow?.arabic ?? "")
          : (tRow?.banglaLine ?? tRow?.bangla ?? "");
      const nextExisting = base.localMap[tLk]?.text ?? tRowFallback;
      const combined = nextExisting ? afterText + " " + nextExisting : afterText;

      // 4. Dry-run cascade plan to detect cross-page / cross-surah impact
      const { fits: nextFits, overflow: nextOverflow } = splitToFit(
        combined,
        availableWidth,
        fontFamily,
        fontSize,
      );

      const plan = planCascade({
        startPageId: targetPageId,
        startRowIndex: targetRowIdx,
        newCurrentText: nextFits,
        pushedText: nextOverflow.trim(),
        layer,
        allPages: scopedPageList,
        localMap: base.localMap,
        layerKeyFn: base.layerKeyFn,
        fontFamily: base.fontFamily,
        fontSize: base.fontSize,
        availableWidth: base.availableWidth,
        surahPageIds: base.surahPageIds,
      });

      const runReflow = () =>
        void reflowFromAsync({
          ...base,
          surahPageIds: scopePageIds,
          startPageId: targetPageId,
          startRowIndex: targetRowIdx,
          startOverflow: combined,
        });

      const cancelEdit = () => {
        // Restore the start row to its pre-edit text
        useOverridesStore.getState().patchLocal(lk, { text: preEditText });
        lastSavedRef.current = preEditText;
        if (ref.current) ref.current.textContent = preEditText;
      };

      // Crosses page or surah → show confirmation dialog
      if (plan.crossesPage || plan.crossesSurah) {
        useEditorStore.getState().setPendingReflow({
          crossesPage: plan.crossesPage,
          crossesSurah: plan.crossesSurah,
          affectedPages: plan.affectedPages,
          confirm: runReflow,
          cancel: cancelEdit,
        });
        return;
      }

      // Same-page change — apply through existing large-change guard
      // (still gates surah/global edits or >20-row impacts).
      requestGuarded({
        scope,
        estimatedRows: plan.rowUpdates.length,
        label: "এন্টার কী প্রয়োগ হচ্ছে…",
        action: runReflow,
      });
      return;
    }

    if (e.key === "Backspace") {
      const el = ref.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed) return;
      const { before } = getTextAroundCursor(el);
      if (before.length > 0) return;

      const base = getReflowBase();
      if (!base.cascade) {
        toast.warning("লিংক বন্ধ — Backspace দিয়ে আগের সারি থেকে টেক্সট টানা যাবে না", { id: `link-off-backspace-${lk}` });
        return;
      }

      e.preventDefault();
      const collapse = () => {
        const result = collapseLineBreakBackward({
          startPageId: pageId,
          startRowIndex: rowIndex,
          layer,
          allPages: base.allPages,
          localMap: useOverridesStore.getState().local,
          patchLocal: useOverridesStore.getState().patchLocal,
          layerKeyFn: base.layerKeyFn,
          fontFamily: base.fontFamily,
          fontSize: base.fontSize,
          availableWidth: base.availableWidth,
          surahPageIds: base.scopedPageIds,
        });
        if (result.merged) {
          const updated = useOverridesStore.getState().local[lk]?.text ?? "";
          lastSavedRef.current = updated;
          if (ref.current) ref.current.textContent = updated;
        }
      };

      if (rowIndex === 0) {
        useEditorStore.getState().setPendingReflow({
          crossesPage: true,
          crossesSurah: false,
          affectedPages: 2,
          confirm: collapse,
        });
        return;
      }

      collapse();
      return;
    }

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir={dir}
        lang={lang}
        spellCheck={false}
        onBlur={() => {
          if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          if (!committedRef.current) commit();
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          display: "block",
          width: "100%",
          minHeight: "1em",
          outline: "2px solid rgba(56,189,248,0.7)",
          outlineOffset: "2px",
          borderRadius: "2px",
          background: "rgba(56,189,248,0.06)",
          caretColor: lang === "ar" ? "#f59e0b" : "#34d399",
          whiteSpace: "nowrap",
          overflow: "hidden",
          cursor: "text",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      />
      <ScopeImpactWarningDialog {...guardDialogProps} />
    </>
  );

}

// Re-export to satisfy legacy types if any
export type { LocalOverride };

// ──────────────────────────────────────────────────────────────────────────────
// WordSpans — per-word rendering inside the Arabic band
// ──────────────────────────────────────────────────────────────────────────────

const WordSpans = memo(function WordSpans({
  text,
  pageId,
  rowIndex,
  interactive,
  fallbackFontPx,
  fallbackTracking,
}: {
  text: string;
  pageId: string;
  rowIndex: number;
  interactive: boolean;
  fallbackFontPx: number;
  fallbackTracking: number;
}) {
  const words = splitArabicWords(text);
  return (
    <>
      {words.map((w, idx) => (
        <span key={idx}>
          {idx > 0 && " "}
          <WordSpan
            word={w}
            pageId={pageId}
            rowIndex={rowIndex}
            wordIndex={idx}
            interactive={interactive}
            fallbackFontPx={fallbackFontPx}
            fallbackTracking={fallbackTracking}
          />
        </span>
      ))}
    </>
  );
});

const WordSpan = memo(function WordSpan({
  word,
  pageId,
  rowIndex,
  wordIndex,
  interactive,
  fallbackFontPx,
  fallbackTracking,
}: {
  word: string;
  pageId: string;
  rowIndex: number;
  wordIndex: number;
  interactive: boolean;
  fallbackFontPx: number;
  fallbackTracking: number;
}) {
  const wk = wordLayerKey(pageId, rowIndex, wordIndex);
  const ov = useOverridesStore((s) => s.local[wk]);
  const selectionKey = useEditorStore((s) => s.selection?.key);
  const isSelected = selectionKey === wk;

  const style: React.CSSProperties = {
    fontSize: ov?.fontPx ?? fallbackFontPx,
    letterSpacing: ov?.tracking ?? fallbackTracking,
    color: ov?.color,
    cursor: interactive ? "pointer" : "inherit",
    outline: isSelected ? "1px dashed rgba(245,158,11,0.9)" : undefined,
    outlineOffset: isSelected ? "2px" : undefined,
    borderRadius: isSelected ? "2px" : undefined,
    pointerEvents: interactive ? "auto" : "none",
  };

  return (
    <span
      data-sel-kind={interactive ? "word" : undefined}
      data-sel-key={interactive ? wk : undefined}
      data-word-index={wordIndex}
      style={style}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              useEditorStore.getState().setSelection({
                kind: "word",
                key: wk,
                pageId,
                rowIndex,
                wordIndex,
              });
            }
          : undefined
      }
    >
      {word}
    </span>
  );
});

