import { memo, useEffect, useRef, useState } from "react";
import { useFont } from "@/context/FontContext";
import type { PageData } from "@/data/pages";
import { useEditorStore, type Selection } from "@/state/editorStore";
import { useOverridesStore } from "@/state/overridesStore";
import { ArchedHeader } from "./ArchedHeader";
import { BismillahBox } from "./BismillahBox";
import { FabricLines, type FabricLine } from "./FabricLines";
import { SlimFooter } from "./SlimFooter";
import { SlimHeader } from "./SlimHeader";
import { SurahOpenBlock } from "./SurahOpenBlock";

/* Canonical SVG coordinate system — matches public/templates/page-default.svg
   (viewBox 420.17 × 630.28). Yellow bands span x = 7.46 → 412.58. */
const VB_W = 420.17;
const VB_H = 630.28;
const DISPLAY_W = 780;
const SCALE = DISPLAY_W / VB_W; // ~1.857
const DISPLAY_H = VB_H * SCALE;

const LINE_X = 7.46;
const LINE_W = 412.58 - 7.46; // 405.12

/** Header / footer bands from the SVG (yellow polylines). */
const HEADER_BAND = { y0: 7.5, y1: 25.41 };
const FOOTER_BAND_Y1 = 622.95;

/** Exact y-coordinates (SVG units) for each of the 9 ayah bands in
 *  public/templates/page-default.svg — top → bottom of each yellow polyline. */
const ROW_BANDS_SVG: Array<[number, number]> = [
  [36.86, 89.81],
  [101.43, 154.38],
  [165.82, 218.77],
  [230.22, 283.16],
  [294.63, 347.58],
  [359.01, 411.96],
  [423.54, 476.49],
  [487.83, 540.77],
  [552.30, 622.95],
];

const FIRST_ROW_Y = ROW_BANDS_SVG[0][0];
const LAST_ROW_Y2 = ROW_BANDS_SVG[ROW_BANDS_SVG.length - 1][1];

const GRID_LEFT_PX = LINE_X * SCALE;
const GRID_TOP_PX = FIRST_ROW_Y * SCALE;
const GRID_W_PX = LINE_W * SCALE;
const GRID_H_PX = (LAST_ROW_Y2 - FIRST_ROW_Y) * SCALE;

/** Within each yellow band: small symbol strip on top, Arabic baseline area
 *  in the middle, Bangla translation pinned to the bottom. Proportions are
 *  picked so font sizes fit cleanly inside the physical band. */
const GRID_LAYOUT_PX = ROW_BANDS_SVG.map(([y0, y1]) => {
  const sy = (y0 - FIRST_ROW_Y) * SCALE;
  const bandH = (y1 - y0) * SCALE;
  const symH = bandH * 0.28;
  const bnH = bandH * 0.24;
  const arH = bandH - symH - bnH;
  return { sy, ay: sy + symH, by: sy + symH + arH, symH, arH, bnH };
});

// Header band (top strip of SVG) and footer band (bottom of last yellow band).
const HEADER_TOP_PX = HEADER_BAND.y0 * SCALE;
const HEADER_H_PX = (HEADER_BAND.y1 - HEADER_BAND.y0) * SCALE;
const FOOTER_H_PX = 16 * SCALE;
const FOOTER_TOP_PX = (FOOTER_BAND_Y1 - 16) * SCALE;

export const Artboard = memo(function Artboard({ page, zoom = 1 }: { page: PageData; zoom?: number }) {
  const { activeFamily } = useFont();
  const isOpen = page.type === "surah-open";

  // Map a PageData into 9 line slots; first 3 are reserved on surah-open pages.
  const slots: FabricLine[] = Array.from({ length: 9 }, () => ({} as FabricLine));
  const skipSlots: number[] = [];
  const inlineSurahOpens: Array<{ index: number; data: NonNullable<PageData["lines"][number]["surahOpen"]> }> = [];
  const startAt = isOpen ? 3 : 0;
  page.lines.slice(0, 9 - startAt).forEach((l, i) => {
    const idx = startAt + i;
    if (l.slotKind === "surah-open" && l.surahOpen) {
      inlineSurahOpens.push({ index: idx, data: l.surahOpen });
      skipSlots.push(idx, idx + 1);
      return;
    }
    if (l.slotKind === "blank") {
      skipSlots.push(idx);
      return;
    }
    slots[idx] = {
      arabic: l.arabicLine ?? l.blocks.map((b) => b.arabic).join(" "),
      bangla: l.banglaLine ?? l.blocks.map((b) => b.bangla).filter(Boolean).join(" "),
      symbol: (l.markers ?? []).join("  "),
    };
  });


  // Header / footer text per page type
  const headerLeft = isOpen ? "১ পারা" : page.para;
  const headerCenter = isOpen
    ? "কু-রীয়ানা পদ্ধতিতে কুর্-আ-ন শিক্ষার কু-রীয়ানা কুর্আ-নুম মাজীদ"
    : page.title;
  const headerRight = isOpen ? "জুলিস ন-ন বী" : page.chapter;

  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setSelection = useEditorStore((s) => s.setSelection);
  const setHover = useEditorStore((s) => s.setHover);
  const selection = useEditorStore((s) => s.selection);
  const hover = useEditorStore((s) => s.hover);
  const showGuides = useEditorStore((s) => s.showGuides);
  const scope = useEditorStore((s) => s.scope);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [selRect, setSelRect] = useState<DOMRect | null>(null);
  // Targeted override snapshot: only re-measure when the selected/hovered keys' overrides change.
  const selOverride = useOverridesStore((s) => (selection?.key ? s.local[selection.key] : undefined));
  const hoverOverride = useOverridesStore((s) => (hover?.key ? s.local[hover.key] : undefined));
  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const isTypeTool = editMode && activeTool === "type";

  // Scope-based selection colors
  const SCOPE_COLORS: Record<string, string> = {
    general: "#f59e0b", page: "#06b6d4", surah: "#8b5cf6", global: "#10b981",
  };
  const selColor = SCOPE_COLORS[scope] ?? "#f59e0b";
  const showPageHighlight = editMode && selection && scope !== "general";

  // Re-measure overlay rects after layout (also on selection / overrides change)
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = (key: string | undefined) => {
      if (!key) return null;
      const el = board.querySelector<HTMLElement>(`[data-sel-key="${CSS.escape(key)}"]`);
      if (!el) return null;
      const br = board.getBoundingClientRect();
      let r = el.getBoundingClientRect();

      // For a row, include the visually shifted bounds of its children (Symbol, Arabic, Bangla layers)
      if (el.getAttribute("data-sel-kind") === "row") {
        const children = Array.from(el.children) as HTMLElement[];
        if (children.length > 0) {
          let minTop = r.top;
          let maxBottom = r.bottom;
          children.forEach((c) => {
            const cr = c.getBoundingClientRect();
            if (cr.height > 0) {
              if (cr.top < minTop) minTop = cr.top;
              if (cr.bottom > maxBottom) maxBottom = cr.bottom;
            }
          });
          r = new DOMRect(r.left, minTop, r.width, maxBottom - minTop);
        }
      }

      // Divide by zoom to account for CSS transform scale on the board
      return new DOMRect((r.left - br.left) / zoom, (r.top - br.top) / zoom, r.width / zoom, r.height / zoom);
    };
    setSelRect(measure(selection?.key));
    setHoverRect(measure(hover?.key));
  }, [selection, hover, page, selOverride, hoverOverride, zoom]);

  // Read which selectable element was clicked
  const readTarget = (e: React.MouseEvent | PointerEvent): Selection | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-sel-key]");
    if (!el) return null;
    const kind = el.getAttribute("data-sel-kind") as Selection["kind"] | null;
    const key = el.getAttribute("data-sel-key");
    if (!kind || !key) return null;
    const rowEl = el.closest<HTMLElement>('[data-row-index]') ?? (el.getAttribute('data-row-index') ? el : null);
    const rowIndex = rowEl ? Number(rowEl.getAttribute("data-row-index") ?? 0) : 0;
    const layerKind = (el.getAttribute("data-layer-kind") as Selection["layerKind"]) ?? undefined;
    return { kind, key, pageId: page.id, rowIndex, layerKind };
  };

  // In Type Tool mode: resolve click to the specific layer (arabic/bangla/symbol).
  // Falls back to arabic layer when user clicks the row background.
  const readLayerTarget = (e: React.MouseEvent | PointerEvent): Selection | null => {
    const target = e.target as HTMLElement;
    // First try to find a specific layer div
    const layerEl = target.closest<HTMLElement>("[data-layer-kind]");
    if (layerEl) {
      const layerKind = layerEl.getAttribute("data-layer-kind") as Selection["layerKind"];
      const rowEl = layerEl.closest<HTMLElement>("[data-row-index]");
      const rowIndex = rowEl ? Number(rowEl.getAttribute("data-row-index") ?? 0) : 0;
      const pageIdAttr = rowEl?.getAttribute("data-page-id") ?? page.id;
      // Build the layer key from pageId + rowIndex + layerKind
      const key = `layer:${pageIdAttr}:${rowIndex}:${layerKind}`;
      return { kind: "layer", key, pageId: page.id, rowIndex, layerKind };
    }
    // Fallback: find the row div and default to arabic layer
    const rowEl = target.closest<HTMLElement>("[data-row-index]");
    if (rowEl) {
      const rowIndex = Number(rowEl.getAttribute("data-row-index") ?? 0);
      const pageIdAttr = rowEl.getAttribute("data-page-id") ?? page.id;
      const key = `layer:${pageIdAttr}:${rowIndex}:arabic`;
      return { kind: "layer", key, pageId: page.id, rowIndex, layerKind: "arabic" };
    }
    return null;
  };

  // Drag-to-move (single delegated pointer handler)
  const dragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    el: HTMLElement;
    baseTransform: string;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editMode) return;
    if (e.button !== 0) return;
    // In Type Tool mode: find the specific layer (arabic/bangla) that was clicked
    if (isTypeTool) {
      const t = readLayerTarget(e);
      if (t) setSelection(t);
      return;
    }
    const t = readTarget(e);
    if (!t) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(`[data-sel-key="${CSS.escape(t.key)}"]`);
    if (!el) return;
    setSelection(t);
    const ov = useOverridesStore.getState().local[t.key];
    dragRef.current = {
      key: t.key,
      startX: e.clientX,
      startY: e.clientY,
      baseDx: ov?.dx ?? 0,
      baseDy: ov?.dy ?? 0,
      el,
      baseTransform: el.style.transform,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (editMode) {
      const t = readTarget(e);
      if (!dragRef.current) setHover(t);
    }
    const d = dragRef.current;
    if (!d) return;
    const ddx = (e.clientX - d.startX) / zoom;
    const ddy = (e.clientY - d.startY) / zoom;
    const nx = d.baseDx + ddx;
    const ny = d.baseDy + ddy;
    if (!d.moved && (Math.abs(ddx) > 1 || Math.abs(ddy) > 1)) {
      d.moved = true;
      setIsDragging(true);
    }
    // Apply directly to DOM for buttery dragging — commit on pointerup.
    // Additive: append a translate() on top of the element's existing transform.
    d.el.style.transform = `${d.baseTransform} translate(${ddx}px, ${ddy}px)`;
    void nx; void ny;
  };



  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setIsDragging(false);
    const ddx = (e.clientX - d.startX) / zoom;
    const ddy = (e.clientY - d.startY) / zoom;
    if (!d.moved) {
      d.el.style.transform = d.baseTransform;
      return;
    }
    patchLocal(d.key, { dx: d.baseDx + ddx, dy: d.baseDy + ddy });
  };

  return (
    <div
      ref={boardRef}
      data-artboard="true"
      data-page-num={page.id.replace(/^vpage-/, "")}
      className="relative mx-auto bg-white shadow-2xl"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseLeave={() => editMode && !dragRef.current && setHover(null)}
      onClick={(e) => {
        if (!editMode) return;
        if (isDragging) return;
        // Type Tool: selection is already handled by onPointerDown.
        // Don't let onClick overwrite (or clear) the selection that was just set.
        if (isTypeTool) return;
        const t = readTarget(e);
        setSelection(t);
      }}
      onDoubleClick={(e) => {
        if (!editMode) return;
        // Double-click: switch to Type Tool and select the specific layer clicked
        const t = readLayerTarget(e);
        if (t) {
          setActiveTool("type");
          setSelection(t);
        }
      }}
      onContextMenu={(e) => {
        if (!editMode) {
          e.preventDefault();
          alert("টেক্সট কপি বা এডিট করতে চাইলে উপরের 'এডিটর' ট্যাবে ক্লিক করে এডিটিং মোড চালু করুন।");
        }
      }}
      style={{
        width: DISPLAY_W,
        height: DISPLAY_H,
        backgroundImage: "var(--page-bg)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#ffffff",
        cursor: isTypeTool ? "text" : editMode ? "crosshair" : "default",
        userSelect: editMode ? "auto" : "none",
        WebkitUserSelect: editMode ? "auto" : "none",
      }}
    >
      {/* Kariana 3-cell header (sits inside the SVG's top yellow band) */}
      <div
        style={{
          position: "absolute",
          left: GRID_LEFT_PX,
          top: HEADER_TOP_PX,
          width: GRID_W_PX,
          height: HEADER_H_PX,
        }}
      >
        <SlimHeader para={headerLeft} title={headerCenter} chapter={headerRight} />
      </div>

      {/* Arched bismillah header overlay for surah-open pages (first 3 lines) */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            left: GRID_LEFT_PX,
            top: GRID_TOP_PX,
            width: GRID_W_PX,
            height: GRID_LAYOUT_PX[2].by + GRID_LAYOUT_PX[2].bnH,
            pointerEvents: "none",
          }}
        >
          <ArchedHeader
            surahName={page.surahName}
            revelation={page.revelation}
            ayah={page.ayah}
            ruku={page.ruku}
          />
          <BismillahBox arabic={page.bismillahArabic} bangla={page.bismillahBangla} />
        </div>
      )}

      {/* Fabric.js justified line grid */}
      <div
        style={{
          position: "absolute",
          left: GRID_LEFT_PX,
          top: GRID_TOP_PX,
          width: GRID_W_PX,
          height: GRID_H_PX,
        }}
      >
        <FabricLines
          width={GRID_W_PX}
          height={GRID_H_PX}
          layout={GRID_LAYOUT_PX}
          lines={slots}
          arabicFamily={activeFamily}
          skip={startAt}
          skipSlots={skipSlots}
          pageId={page.id}
        />

        {/* Inline surah-open SVG blocks (span 2 line bands each) */}
        {inlineSurahOpens.map(({ index, data }) => {
          const top = GRID_LAYOUT_PX[index].sy;
          const next = GRID_LAYOUT_PX[Math.min(index + 1, GRID_LAYOUT_PX.length - 1)];
          const bottom = next.by + next.bnH;
          return (
            <div
              key={`so-${index}`}
              style={{
                position: "absolute",
                left: 0,
                top,
                width: GRID_W_PX,
                height: bottom - top,
              }}
            >
              <SurahOpenBlock
                surahName={data.surahName}
                revelation={data.revelation}
                ayah={data.ayah}
                ruku={data.ruku}
                bismillahArabic={data.bismillahArabic}
                bismillahBangla={data.bismillahBangla}
                width={GRID_W_PX}
                height={bottom - top}
                arabicFamily={activeFamily}
              />
            </div>
          );
        })}
      </div>

      {/* Kariana 5-cell footer (inside last yellow band) */}
      <div
        style={{
          position: "absolute",
          left: GRID_LEFT_PX,
          top: FOOTER_TOP_PX,
          width: GRID_W_PX,
          height: FOOTER_H_PX,
        }}
      >
        <SlimFooter data={page.footer} />
      </div>

      {/* Guides overlay — baselines for each row band */}
      {showGuides && (
        <svg
          width={DISPLAY_W}
          height={DISPLAY_H}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
          {GRID_LAYOUT_PX.map((L, i) => {
            const y = GRID_TOP_PX + L.sy;
            const h = L.symH + L.arH + L.bnH;
            return (
              <g key={`g-${i}`} stroke="#0ea5e9" strokeDasharray="3 3" opacity={0.55}>
                <line x1={GRID_LEFT_PX} y1={y} x2={GRID_LEFT_PX + GRID_W_PX} y2={y} />
                <line x1={GRID_LEFT_PX} y1={y + L.symH} x2={GRID_LEFT_PX + GRID_W_PX} y2={y + L.symH} strokeDasharray="1 2" />
                <line x1={GRID_LEFT_PX} y1={y + L.symH + L.arH} x2={GRID_LEFT_PX + GRID_W_PX} y2={y + L.symH + L.arH} strokeDasharray="1 2" />
                <line x1={GRID_LEFT_PX} y1={y + h} x2={GRID_LEFT_PX + GRID_W_PX} y2={y + h} />
              </g>
            );
          })}
        </svg>
      )}

      {/* Hover outline */}
      {editMode && hoverRect && (
        <div
          style={{
            position: "absolute",
            left: hoverRect.x - 2,
            top: hoverRect.y - 2,
            width: hoverRect.width + 4,
            height: hoverRect.height + 4,
            border: `1.5px dashed ${selColor}`,
            borderRadius: 3,
            pointerEvents: "none",
            opacity: 0.6,
          }}
        />
      )}

      {/* Row selection outline */}
      {editMode && selRect && (
        <div
          style={{
            position: "absolute",
            left: selRect.x - 2,
            top: selRect.y - 2,
            width: selRect.width + 4,
            height: selRect.height + 4,
            border: `2px solid ${selColor}`,
            borderRadius: 3,
            boxShadow: `0 0 0 3px ${selColor}22, 0 0 12px ${selColor}30`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Page/Surah/Para/Global scope highlight — full canvas border */}
      {showPageHighlight && (
        <div
          style={{
            position: "absolute",
            inset: -3,
            border: `2.5px solid ${selColor}`,
            borderRadius: 4,
            boxShadow: `0 0 0 1px ${selColor}40, 0 0 24px ${selColor}25`,
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          {/* Scope badge */}
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{
              background: selColor,
              color: "#0a0a0a",
              whiteSpace: "nowrap",
            }}
          >
            {scope === "page" ? "পেজ সিলেক্ট" :
             scope === "surah" ? "সূরা সিলেক্ট" : "সব সিলেক্ট"}
          </div>
        </div>
      )}
    </div>
  );
});
