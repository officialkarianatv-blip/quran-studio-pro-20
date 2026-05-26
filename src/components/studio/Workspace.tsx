import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { FontProvider } from "@/context/FontContext";
import { BackgroundProvider } from "@/context/BackgroundContext";
import { TajweedRulesProvider } from "@/context/TajweedRulesContext";
import { Artboard } from "./Artboard";
import { CanvasToolbar } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { PageList } from "./PageList";
import { ResizeDivider } from "./ResizeDivider";
import { TopBar } from "./TopBar";
import { SelectionPanel } from "./SelectionPanel";
import { Toaster } from "@/components/ui/sonner";
import { CrossPageReflowDialog } from "./CrossPageReflowDialog";
import { toast } from "sonner";
import { captureSessionBaseline, useOverridesStore } from "@/state/overridesStore";
import { useEditorStore } from "@/state/editorStore";
import { useHistoryStore } from "@/state/historyStore";
import { useReflowStore } from "@/state/reflowStore";
import { getVisiblePageId } from "@/lib/editorContext";
import type { BuildProgress } from "@/state/reflowStore";

type Stage = "ui" | "ready";

// ── Panel size limits ─────────────────────────────────────────────
const LEFT_MIN = 160;
const LEFT_MAX = 420;
const RIGHT_MIN = 240;
const RIGHT_MAX = 500;
const clampLeft = (w: number) => Math.max(LEFT_MIN, Math.min(LEFT_MAX, w));
const clampRight = (w: number) => Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, w));

export function Workspace() {
  const [mounted, setMounted] = useState(false);
  const pages = useReflowStore((s) => s.pages);
  const initReflow = useReflowStore((s) => s.init);
  const buildProgress = useReflowStore((s) => s.buildProgress);
  const isReflowing = useReflowStore((s) => s.isReflowing);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePageId = useEditorStore((s) => s.setActivePageId);
  const editMode = useEditorStore((s) => s.editMode);
  const markSessionStart = useHistoryStore((s) => s.markSessionStart);
  const [zoom, setZoom] = useState(85);
  const setEditorZoom = useEditorStore((s) => s.setZoom);
  const [stage, setStage] = useState<"ui" | "ready">("ui");

  // ── Sidebar panel toggle + resize state ───────────────────────
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(320);

  // ── Mobile detection (SSR-safe) ───────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Panel resize handlers ─────────────────────────────────────
  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => clampLeft(w + delta));
  }, []);
  const handleRightResize = useCallback((delta: number) => {
    // Right panel: drag right → smaller (canvas grows), drag left → bigger
    setRightWidth((w) => clampRight(w - delta));
  }, []);

  // Pan and Zoom state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, sx: 0, sy: 0 });

  useEffect(() => setMounted(true), []);

  const activeId = getVisiblePageId() ?? "";

  const active = useMemo(
    () => pages.find((p) => p.id === activeId) ?? pages[0],
    [activeId, pages],
  );

  const activeIdx = useMemo(() => {
    const idx = pages.findIndex((p) => p.id === activeId);
    return Math.max(0, idx);
  }, [activeId, pages]);

  const goToPrev = useCallback(() => {
    if (activeIdx > 0) setActivePageId(pages[activeIdx - 1]!.id);
  }, [activeIdx, pages, setActivePageId]);

  const goToNext = useCallback(() => {
    if (activeIdx < pages.length - 1) setActivePageId(pages[activeIdx + 1]!.id);
  }, [activeIdx, pages, setActivePageId]);

  // Seed / repair activePageId after reflow shuffles pages.
  useEffect(() => {
    if (!pages.length) return;
    const cur = useEditorStore.getState().activePageId;
    if (!cur || !pages.find((p) => p.id === cur)) {
      setActivePageId(pages[0]!.id);
    }
  }, [pages, setActivePageId]);

  // Legacy: clear navigateToPageId after external navigation (do not clear row flash).
  const navigateToPageId = useEditorStore((s) => s.navigateToPageId);
  useEffect(() => {
    if (!navigateToPageId) return;
    useEditorStore.setState({ navigateToPageId: null });
  }, [navigateToPageId]);

  const distribution = useReflowStore((s) => s.distribution);
  const totalAyat = useMemo(
    () => distribution.reduce((acc, d) => {
      if (d.firstVerse != null && d.lastVerse != null) {
        return acc + (d.lastVerse - d.firstVerse + 1);
      }
      return acc;
    }, 0),
    [distribution],
  );

  // Boot the reflow store once.
  useEffect(() => {
    void initReflow();
  }, [initReflow]);

  // Fast boot — mark ready after a single animation frame
  useEffect(() => {
    let cancelled = false;
    setStage("ui");
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setStage("ready");
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Start a fresh undo/history session each time editor mode opens.
  useEffect(() => {
    if (!editMode) return;
    markSessionStart();
    captureSessionBaseline();
  }, [editMode, markSessionStart]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Spacebar panning
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setIsSpaceDown(true);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      const targetEl = e.target as HTMLElement | null;
      const inContentEditable = targetEl?.closest('[contenteditable="true"]') !== null;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || inContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+Z / Ctrl+Shift+Z — undo/redo
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useOverridesStore.temporal.getState().redo();
        else useOverridesStore.temporal.getState().undo();
        return;
      }

      // Ctrl+P — open PDF export (prevent browser print)
      if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        document.getElementById("btn-export-pdf")?.click();
        return;
      }

      if (inInput) return;

      const sel = useEditorStore.getState().selection;

      // Arrow nudge when row is selected
      if (sel && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const cur = useOverridesStore.getState().local[sel.key] ?? {};
        const dx = cur.dx ?? 0;
        const dy = cur.dy ?? 0;
        const patch =
          e.key === "ArrowLeft" ? { dx: dx - step }
          : e.key === "ArrowRight" ? { dx: dx + step }
          : e.key === "ArrowUp" ? { dy: dy - step }
          : { dy: dy + step };
        useOverridesStore.getState().patchLocal(sel.key, patch);
        return;
      }

      // ← / → page navigation (when no row is selected)
      if (!sel && e.key === "ArrowLeft") { e.preventDefault(); goToPrev(); return; }
      if (!sel && e.key === "ArrowRight") { e.preventDefault(); goToNext(); return; }

      // Alt+1/2/3/4 → switch editing scope
      if (e.altKey && !e.ctrlKey && !e.metaKey && ["1","2","3","4"].includes(e.key)) {
        e.preventDefault();
        const map = {
          "1": { scope: "general" as const, label: "সাধারণ" },
          "2": { scope: "page"    as const, label: "পেজ" },
          "3": { scope: "surah"   as const, label: "সূরা" },
          "4": { scope: "global"  as const, label: "সকল" },
        };
        const pick = map[e.key as "1"|"2"|"3"|"4"];
        useEditorStore.getState().setScope(pick.scope);
        toast.success(`এডিটিং মোড পরিবর্তন: ${pick.label}`);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "escape":
          e.preventDefault();
          if (useEditorStore.getState().activeTool === "type") {
            useEditorStore.getState().setActiveTool("select");
          } else if (sel) {
            useEditorStore.getState().setSelection(null);
          } else if (useEditorStore.getState().layerPanelOpen) {
            useEditorStore.getState().setLayerPanelOpen(false);
          } else if (useEditorStore.getState().editMode) {
            useEditorStore.getState().toggleEditMode();
          }
          break;
        case "v":
          if (useEditorStore.getState().editMode) {
            e.preventDefault();
            useEditorStore.getState().setActiveTool("select");
          }
          break;
        case "t":
          if (useEditorStore.getState().editMode) {
            e.preventDefault();
            useEditorStore.getState().setActiveTool("type");
          }
          break;
        case "e":
          e.preventDefault();
          useEditorStore.getState().toggleEditMode();
          break;
        case "g":
          e.preventDefault();
          useEditorStore.getState().setShowGuides(!useEditorStore.getState().showGuides);
          break;
        case "l":
          e.preventDefault();
          useEditorStore.getState().toggleLayerPanel();
          break;
        case "f":
          e.preventDefault();
          setZoom(85);
          break;
        case "[":
          e.preventDefault();
          setZoom((z) => Math.max(25, z - 10));
          break;
        case "]":
          e.preventDefault();
          setZoom((z) => Math.min(300, z + 10));
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
        isDragging.current = false;
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [goToPrev, goToNext]);

  // Sync zoom (percentage) to editorStore as a 0–3 scale factor for drag calculations
  useEffect(() => {
    setEditorZoom(zoom / 100);
  }, [zoom, setEditorZoom]);

  // Native wheel handler to prevent browser zoom (passive: false is required)
  useEffect(() => {
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom((z) => Math.max(25, Math.min(300, z + delta)));
      }
    };

    window.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    // Don't pan if clicking an interactive element, UNLESS spacebar is held
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-sel-key]')) {
      if (!isSpaceDown) return;
    }

    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      sx: scrollRef.current?.scrollLeft || 0,
      sy: scrollRef.current?.scrollTop || 0,
    };
    target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging.current && scrollRef.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      scrollRef.current.scrollLeft = dragStart.current.sx - dx;
      scrollRef.current.scrollTop = dragStart.current.sy - dy;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // SSR skeleton
  if (!mounted) {
    return (
      <div className="flex h-screen flex-col bg-neutral-950">
        <div className="flex h-[52px] items-center gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4">
          <div className="h-9 w-9 animate-pulse rounded-md bg-amber-500/20" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-28 animate-pulse rounded bg-neutral-700" />
            <div className="h-2 w-20 animate-pulse rounded bg-neutral-800" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-neutral-800 bg-neutral-950" />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 text-neutral-500 text-sm">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
              লোড হচ্ছে…
            </div>
          </div>
          <div className="w-[320px] border-l border-neutral-800 bg-neutral-950" />
        </div>
      </div>
    );
  }

  // ── Mobile Layout ─────────────────────────────────────────────
  if (isMobile) {
    const mobileScale = Math.min(1, (window.innerWidth - 16) / 780);
    return (
      <>
        <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
          {/* Simple mobile TopBar */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-400" />
              <span className="font-bold text-sm text-amber-300">কুরআন পাবলিশার</span>
            </div>
            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400">
              {pages.length} পেজ
            </span>
          </div>

          {/* Canvas — scales to fit mobile screen */}
          <div className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top,#1c1917_0%,#0a0a0a_70%)]">
            {stage !== "ready" || buildProgress !== null ? (
              <div className="flex h-full items-center justify-center">
                <BootOverlay buildProgress={buildProgress} />
              </div>
            ) : (
              <div
                className="flex min-h-full items-start justify-center py-4"
                style={{ paddingInline: 8 }}
              >
                <div
                  style={{
                    transform: `scale(${mobileScale})`,
                    transformOrigin: "top center",
                    width: 780,
                    height: 1170 * mobileScale + 32,
                  }}
                >
                  <Artboard page={active} zoom={1} />
                </div>
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation */}
          <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900 px-4 py-3">
            <button
              onClick={goToPrev}
              disabled={activeIdx <= 0}
              className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> আগের
            </button>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">পেজ</div>
              <div className="text-lg font-bold tabular-nums text-amber-300">
                {activeIdx + 1}
                <span className="text-sm font-normal text-neutral-500"> / {pages.length}</span>
              </div>
            </div>
            <button
              onClick={goToNext}
              disabled={activeIdx >= pages.length - 1}
              className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-30"
            >
              পরের <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Toaster position="bottom-center" theme="dark" richColors />
        <CrossPageReflowDialog />
      </>
    );
  }

  // ── Desktop Layout ────────────────────────────────────────────
  return (
    <>
      <FontProvider>
        <BackgroundProvider>
          <TajweedRulesProvider>
            <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
              <TopBar totalPages={pages.length} totalAyat={Math.max(totalAyat, 7)} />

              <div className="flex flex-1 overflow-hidden">

                {/* ── Left Sidebar (PageList) ── */}
                {leftOpen && (
                  <>
                    <div
                      className="flex-shrink-0 overflow-hidden border-r border-neutral-800 transition-[width] duration-200"
                      style={{ width: leftWidth }}
                    >
                      <PageList pages={pages} activeId={activeId} onSelect={setActivePageId} />
                    </div>
                    <ResizeDivider onResize={handleLeftResize} />
                  </>
                )}

                {/* ── Main Canvas Area ── */}
                <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <CanvasToolbar
                    zoom={zoom}
                    setZoom={setZoom}
                    pageLabel={`পেজ: ${active?.footer.pageNo ?? ""} (${active?.lines.filter(l => l.slotKind === "ayah").length ?? 9} সারি)`}
                    onPrevPage={goToPrev}
                    onNextPage={goToNext}
                    canGoPrev={activeIdx > 0}
                    canGoNext={activeIdx < pages.length - 1}
                    leftOpen={leftOpen}
                    rightOpen={rightOpen}
                    onToggleLeft={() => setLeftOpen((v) => !v)}
                    onToggleRight={() => setRightOpen((v) => !v)}
                  />
                  <div className="relative flex-1 bg-[radial-gradient(ellipse_at_top,#1c1917_0%,#0a0a0a_70%)] overflow-hidden">
                    {stage !== "ready" || buildProgress !== null ? (
                      <BootOverlay buildProgress={buildProgress} />
                    ) : (
                      <>
                        {/* Canvas Scroll Area */}
                        <div
                          ref={scrollRef}
                          onPointerDown={onPointerDown}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          className={`absolute inset-0 overflow-auto text-center ${isSpaceDown ? 'cursor-grab' : ''} ${isSpaceDown && isDragging.current ? 'cursor-grabbing' : ''}`}
                          style={{ padding: "40px 0" }}
                        >
                          <div
                            style={{
                              display: "inline-block",
                              textAlign: "left",
                              width: 780 * (zoom / 100),
                              height: 1170 * (zoom / 100),
                              position: "relative",
                              transition: "width 100ms ease-out, height 100ms ease-out",
                            }}
                          >
                            {/* 3-page virtualization window */}
                            {[
                              { p: activeIdx > 0 ? pages[activeIdx - 1] : null, visible: false, k: "prev" },
                              { p: active, visible: true, k: "active" },
                              { p: activeIdx < pages.length - 1 ? pages[activeIdx + 1] : null, visible: false, k: "next" },
                            ].map(({ p, visible, k }) =>
                              p ? (
                                <div
                                  key={`${k}-${p.id}`}
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    transform: `scale(${zoom / 100})`,
                                    transformOrigin: "top left",
                                    transition: "transform 100ms ease-out",
                                    visibility: visible ? "visible" : "hidden",
                                    pointerEvents: visible ? "auto" : "none",
                                  }}
                                >
                                  <Artboard page={p} zoom={zoom / 100} />
                                </div>
                              ) : null,
                            )}
                          </div>
                        </div>

                        {/* Fixed UI Overlays (Arrows & Page Counter) */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-6">
                          <button
                            onClick={goToPrev}
                            disabled={activeIdx <= 0}
                            title="আগের পেজ (←)"
                            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-400 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-20 disabled:hover:bg-neutral-900/80 disabled:hover:text-neutral-400"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={goToNext}
                            disabled={activeIdx >= pages.length - 1}
                            title="পরের পেজ (→)"
                            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-400 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-20 disabled:hover:bg-neutral-900/80 disabled:hover:text-neutral-400"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
                          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/90 px-3 py-1.5 text-xs backdrop-blur shadow-lg shadow-black/20">
                            <span className="text-neutral-500">পেজ</span>
                            <span className="font-bold text-amber-300">{activeIdx + 1}</span>
                            <span className="text-neutral-600">/</span>
                            <span className="text-neutral-400">{pages.length}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </main>

                {/* ── Right Sidebar (Inspector) ── */}
                {rightOpen && (
                  <>
                    <ResizeDivider onResize={handleRightResize} />
                    <div
                      className="flex-shrink-0 overflow-hidden border-l border-neutral-800 transition-[width] duration-200"
                      style={{ width: rightWidth }}
                    >
                      <Inspector page={active} />
                    </div>
                  </>
                )}

              </div>

              {/* Legacy selection pill — hidden, replaced by LayerWindow */}
              <SelectionPanel />
            </div>
          </TajweedRulesProvider>
        </BackgroundProvider>
      </FontProvider>
      <Toaster position="bottom-right" theme="dark" richColors />
      {/* Background cascade loading overlay */}
      {isReflowing && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center pb-8">
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-neutral-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            </span>
            <span className="text-xs font-medium text-amber-300">রিফ্লো হচ্ছে…</span>
          </div>
        </div>
      )}
    </>
  );
}

function BootOverlay({ buildProgress }: { buildProgress: BuildProgress | null }) {
  const pct = buildProgress?.pct ?? 0;
  const label = buildProgress?.label ?? "লোড হচ্ছে…";
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-[300px] rounded-xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-2xl backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Studio Al-Qalam</span>
        </div>
        <p className="text-sm text-neutral-300">{label}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct > 0 && (
          <p className="mt-1.5 text-right text-[10px] text-neutral-600">{pct}%</p>
        )}
      </div>
    </div>
  );
}
