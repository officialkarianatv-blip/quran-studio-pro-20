import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { detectTajweed, type TajweedMatch } from "@/lib/tajweed/rules";
import { measureCharCenter } from "@/lib/tajweed/measure";
import { TAJWEED_CHAR } from "@/lib/tajweed/svgMap";
import { useTajweedRules } from "@/context/TajweedRulesContext";
import { useOverridesStore } from "@/state/overridesStore";
import { useEditorStore } from "@/state/editorStore";

type Props = {
  arabic: string;
  arabicSpanRef: React.RefObject<HTMLSpanElement | null>;
  width: number;
  height: number;
  /** kept for API compatibility; not used by the SVG renderer */
  fontFamily?: string;
  /** Visual size of each top-symbol SVG in px. */
  fontSize?: number;
  /** Identifiers used to build stable selection/override keys. */
  pageId?: string;
  rowIndex?: number;
  /** The actual displayed text (may differ from `arabic` if user edited it) */
  displayArabic?: string;
  /** Whether the row is currently being edited (span is unmounted) */
  isEditing?: boolean;
};

/** Overlay strip that paints each enabled Tajweed rule as an SVG icon,
 *  vertically locked inside the symH band and horizontally anchored to the
 *  measured x-center of its target Arabic character. */
export function TopSymbolLayer({
  arabic,
  arabicSpanRef,
  width,
  height,
  fontSize = 14,
  pageId = "page",
  rowIndex = 0,
  displayArabic,
  isEditing = false,
}: Props) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [liveText, setLiveText] = useState<string>(displayArabic ?? arabic ?? "");
  const [positions, setPositions] = useState<Array<TajweedMatch & { x: number }>>([]);
  const { isEnabled } = useTajweedRules();
  const localMap = useOverridesStore((s) => s.local);
  const gSymbolScale = useOverridesStore((s) => s.global.symbolScale) ?? 1;
  const editMode = useEditorStore((s) => s.editMode);

  // Re-sync liveText when external props change (non-editing state)
  useLayoutEffect(() => {
    if (!isEditing) setLiveText(displayArabic ?? arabic ?? "");
  }, [displayArabic, arabic, isEditing]);

  // While editing, observe the contentEditable's text node and mirror it
  // so tajweed symbols continue to track live keystrokes.
  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = arabicSpanRef.current;
    if (!el) return;
    const update = () => setLiveText(el.textContent ?? "");
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { characterData: true, childList: true, subtree: true });
    return () => mo.disconnect();
  }, [isEditing, arabicSpanRef]);

  const effectiveArabic = liveText;
  const matches = useMemo(
    () => (effectiveArabic ? detectTajweed(effectiveArabic).filter((m) => isEnabled(m.symbol)) : []),
    [effectiveArabic, isEnabled],
  );

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    let raf = 0;
    let cancelled = false;

    const recompute = () => {
      if (cancelled) return;
      const span = arabicSpanRef.current;
      if (!span) return;
      const next: Array<TajweedMatch & { x: number }> = [];
      for (const m of matches) {
        const x = measureCharCenter(span, layer, m.charIndex);
        if (x != null) next.push({ ...m, x });
      }
      setPositions((prev) => {
        if (prev.length !== next.length) return next;
        for (let i = 0; i < prev.length; i++) {
          if (
            prev[i].x !== next[i].x ||
            prev[i].charIndex !== next[i].charIndex ||
            prev[i].symbol !== next[i].symbol
          ) {
            return next;
          }
        }
        return prev;
      });
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    schedule();

    const ro = new ResizeObserver(schedule);
    if (arabicSpanRef.current) ro.observe(arabicSpanRef.current);
    ro.observe(layer);

    const onResize = () => schedule();
    window.addEventListener("resize", onResize);

    let fontDispose: (() => void) | null = null;
    if (typeof document !== "undefined" && (document as { fonts?: FontFaceSet }).fonts) {
      const fonts = document.fonts;
      const onFonts = () => schedule();
      fonts.addEventListener?.("loadingdone", onFonts);
      fonts.ready?.then?.(schedule).catch?.(() => {});
      fontDispose = () => fonts.removeEventListener?.("loadingdone", onFonts);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      fontDispose?.();
    };
  }, [matches, arabicSpanRef, width, height, effectiveArabic, isEditing]);

  // Let the icon grow to ~95% of the symH band, capped by fontSize and band height.
  const symbolH = Math.max(10, Math.min(15, height - 2, Math.round(height * 0.95)));

  return (
    <div
      ref={layerRef}
      style={{
        position: "absolute",
        left: 0,
        top: -16,
        width,
        height,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {positions.map((p, i) => {
        const key = `symbol:${pageId}:${rowIndex}:${p.charIndex}:${p.symbol}`;
        const ov = localMap[key];
        const scale = (ov?.scale ?? 1) * gSymbolScale;
        const sizePx = ov?.fontPx ?? symbolH;
        const tx = ov?.dx ?? 0;
        const ty = ov?.dy ?? 0;
        return (
          <span
            key={`${p.charIndex}-${p.symbol}-${i}`}
            className="tajweed-icon"
            aria-hidden="true"
            data-sel-kind="symbol"
            data-sel-key={key}
            style={{
              position: "absolute",
              left: p.x + tx,
              top: ty,
              transform: `translateX(-50%) scale(${scale})`,
              transformOrigin: "top center",
              width: sizePx,
              height: sizePx,
              fontSize: sizePx,
              lineHeight: `${sizePx}px`,
              textAlign: "center",
              color: "#ef4444", // User requested all symbols to be red
              display: "block",
              pointerEvents: editMode ? "auto" : "none",
              cursor: editMode ? "grab" : "default",
            }}
          >
            {TAJWEED_CHAR[p.symbol]}
          </span>
        );
      })}
    </div>
  );
}
