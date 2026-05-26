// Studio Al-Qalam — Canvas Toolbar (Phase 5: panel toggles + resize support)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileImage,
  Grid3x3,
  History,
  Maximize2,
  Minus,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Type,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import type { SelectionScope } from "@/state/editorStore";
import { useOverridesStore } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { useHistoryStore, relativeTime, type HistoryEntry, type HistoryPatch } from "@/state/historyStore";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  zoom: number;
  setZoom: (z: number) => void;
  pageLabel: string;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  /** Sidebar panel toggle props */
  leftOpen?: boolean;
  rightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
};

export function CanvasToolbar({
  zoom,
  setZoom,
  pageLabel,
  onPrevPage,
  onNextPage,
  canGoPrev,
  canGoNext,
  leftOpen = true,
  rightOpen = true,
  onToggleLeft,
  onToggleRight,
}: Props) {
  const clamp = (z: number) => Math.max(25, Math.min(300, Math.round(z)));
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const scope = useEditorStore((s) => s.scope);
  const setScope = useEditorStore((s) => s.setScope);
  const showGuides = useEditorStore((s) => s.showGuides);
  const setShowGuides = useEditorStore((s) => s.setShowGuides);
  const pastCount = useStore(useOverridesStore.temporal, (s) => s.pastStates.length);
  const futureCount = useStore(useOverridesStore.temporal, (s) => s.futureStates.length);
  const undo = () => useOverridesStore.temporal.getState().undo();
  const redo = () => useOverridesStore.temporal.getState().redo();
  const versesReady = useReflowStore((s) => s.versesReady);
  const rebuilding = useReflowStore((s) => s.rebuilding);
  const isReflowing = useReflowStore((s) => s.isReflowing);
  const buildProgress = useReflowStore((s) => s.buildProgress);
  const entries = useHistoryStore(useShallow((s) => s.sessionEntries()));
  const [histOpen, setHistOpen] = useState(false);
  const [clearAlertOpen, setClearAlertOpen] = useState(false);
  const [zoomEditing, setZoomEditing] = useState(false);
  const [zoomInput, setZoomInput] = useState("");
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const histRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);

  // Position popover under button using fixed coords (escapes overflow:hidden parents)
  useLayoutEffect(() => {
    if (!histOpen || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 320;
    setPopPos({ top: r.bottom + 4, left: Math.max(8, r.right - width) });
  }, [histOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!histOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (histRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setHistOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [histOpen]);

  // Zoom edit helpers
  const startZoomEdit = () => {
    setZoomInput(String(zoom));
    setZoomEditing(true);
    setTimeout(() => zoomInputRef.current?.select(), 10);
  };
  const commitZoomEdit = () => {
    const v = parseInt(zoomInput, 10);
    if (!isNaN(v)) setZoom(clamp(v));
    setZoomEditing(false);
  };

  const SCOPE_META: Record<SelectionScope, { labelBn: string; color: string }> = {
    general: { labelBn: "সাধারণ", color: "#f59e0b" },
    page:    { labelBn: "পেজ",   color: "#06b6d4" },
    surah:   { labelBn: "সূরা",  color: "#8b5cf6" },
    global:  { labelBn: "সকল",   color: "#10b981" },
  };
  const SCOPES: SelectionScope[] = ["general", "page", "surah", "global"];

  // Recent 10 entries newest-first
  const recent = [...entries].reverse().slice(0, 10);

  return (
    <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/80 px-3 py-1.5 text-neutral-300 backdrop-blur-sm">

      {/* ── Left ── */}
      <div className="flex items-center gap-1">
        {/* Left sidebar toggle */}
        {onToggleLeft && (
          <button
            onClick={onToggleLeft}
            title={leftOpen ? "পেজ তালিকা লুকান" : "পেজ তালিকা দেখান"}
            className={`mr-1 grid h-7 w-7 place-items-center rounded-md border transition-colors ${
              leftOpen
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {editMode ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool("select")}
            title="Selection Tool (V)"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              activeTool === "select"
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <MousePointer2 className="h-3 w-3" />V
          </button>
          <button
            onClick={() => setActiveTool("type")}
            title="Type Tool (T)"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              activeTool === "type"
                ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <Type className="h-3 w-3" />T
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <ToolBtn onClick={onPrevPage} disabled={!canGoPrev} title="আগের পেজ (←)">
            <ChevronLeft className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="min-w-[80px] rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-center text-[11px] text-neutral-300">
            {pageLabel}
          </span>
          <ToolBtn onClick={onNextPage} disabled={!canGoNext} title="পরের পেজ (→)">
            <ChevronRight className="h-3.5 w-3.5" />
          </ToolBtn>
          {!versesReady && !buildProgress && (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />লোড হচ্ছে…
            </span>
          )}
          {buildProgress && (
            <span className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
              <span className="h-1.5 w-1.5 animate-spin rounded-full border border-amber-400 border-t-transparent" />
              {buildProgress.label}
              <span className="tabular-nums text-amber-500 font-bold">{buildProgress.pct}%</span>
            </span>
          )}
          {versesReady && rebuilding && !buildProgress && (
            <span className="flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">
              <span className="h-1.5 w-1.5 animate-spin rounded-full border border-sky-400 border-t-transparent" />রিবিল্ড…
            </span>
          )}
          {versesReady && isReflowing && !buildProgress && !rebuilding && (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
              <span className="h-1.5 w-1.5 animate-spin rounded-full border border-amber-400 border-t-transparent" />রিফ্লো হচ্ছে…
            </span>
          )}
        </div>
        )}
      </div>

      {/* ── Center ── */}
      {editMode ? (
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-neutral-600">প্রয়োগ</span>
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              title={SCOPE_META[s].labelBn}
              className="rounded px-2 py-1 text-[11px] font-semibold transition-all"
              style={scope === s
                ? { background: `${SCOPE_META[s].color}22`, border: `1px solid ${SCOPE_META[s].color}55`, color: SCOPE_META[s].color }
                : { background: "#1a1a1a", border: "1px solid #262626", color: "#525252" }
              }
            >
              {SCOPE_META[s].labelBn}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <ToolBtn onClick={() => setZoom(clamp(zoom - 10))} title="Zoom out ([)"><Minus className="h-3.5 w-3.5" /></ToolBtn>

          {/* Clickable zoom display — click to type exact % */}
          {zoomEditing ? (
            <input
              ref={zoomInputRef}
              type="number"
              min={25}
              max={300}
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={commitZoomEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitZoomEdit();
                if (e.key === "Escape") setZoomEditing(false);
              }}
              className="w-[52px] rounded-md border border-amber-500/60 bg-neutral-800 px-1 py-1 text-center text-xs font-bold tabular-nums text-amber-200 outline-none focus:border-amber-400"
            />
          ) : (
            <button
              onClick={startZoomEdit}
              title="클릭해서 줌 직접 입력"
              className="min-w-[52px] rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-center text-xs font-bold tabular-nums text-neutral-200 hover:border-amber-500/40 hover:text-amber-200 transition-colors"
            >
              {zoom}%
            </button>
          )}

          <ToolBtn onClick={() => setZoom(clamp(zoom + 10))} title="Zoom in (])"><Plus className="h-3.5 w-3.5" /></ToolBtn>
          <button onClick={() => setZoom(85)} className="ml-1 flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100" title="ফিট করুন (F)">
            <Maximize2 className="h-3 w-3" />ফিট
          </button>
          <button onClick={() => setZoom(100)} className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100" title="100%">
            <ZoomIn className="h-3 w-3" />1:1
          </button>
        </div>
      )}

      {/* ── Right ── */}
      <div className="flex items-center gap-1">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-800 bg-neutral-800/50 p-0.5">
          <button onClick={undo} disabled={pastCount === 0} title={`Undo (Ctrl+Z) · ${pastCount}`} className="relative grid h-6 w-6 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30">
            <Undo2 className="h-3.5 w-3.5" />
            {pastCount > 0 && (<span className="absolute -right-0.5 -top-0.5 grid h-3 min-w-[12px] place-items-center rounded-full bg-amber-500 px-0.5 text-[7px] font-black text-neutral-950">{pastCount > 9 ? "9+" : pastCount}</span>)}
          </button>
          <button onClick={redo} disabled={futureCount === 0} title={`Redo (Ctrl+Shift+Z) · ${futureCount}`} className="grid h-6 w-6 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-neutral-800" />

        {/* History dropdown */}
        <div className="relative" ref={histRef}>
          <button
            ref={btnRef}
            onClick={() => setHistOpen((v) => !v)}
            title="পরিবর্তনের ইতিহাস"
            className={`relative grid h-7 w-7 place-items-center rounded-md border transition-colors ${
              histOpen
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            {entries.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-3 min-w-[12px] place-items-center rounded-full bg-amber-500 px-0.5 text-[7px] font-black text-neutral-950">
                {entries.length > 9 ? "9+" : entries.length}
              </span>
            )}
          </button>

          {histOpen && popPos && typeof document !== "undefined" && createPortal(
            <div
              ref={popRef}
              style={{ position: "fixed", top: popPos.top, left: popPos.left, width: 320, zIndex: 9999 }}
              className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                  <Clock className="h-3 w-3" />পরিবর্তনের ইতিহাস
                </div>
                <button
                  onClick={() => setClearAlertOpen(true)}
                  className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
                >মুছুন</button>
                <AlertDialog open={clearAlertOpen} onOpenChange={setClearAlertOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>সব ইতিহাস মুছবেন?</AlertDialogTitle>
                      <AlertDialogDescription>
                        আপনি কি সব ইতিহাস মুছতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>বাতিল</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        useHistoryStore.getState().clear();
                        useOverridesStore.temporal.getState().clear();
                      }} className="bg-red-600 hover:bg-red-700 text-white">
                        হ্যাঁ, মুছুন
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {recent.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px] text-neutral-600">কোনো ইতিহাস নেই</div>
                ) : (
                  recent.map((entry) => (
                    <HistoryItem key={entry.id} entry={entry} onClose={() => setHistOpen(false)} />
                  ))
                )}
              </div>
            </div>,
            document.body,
          )}
        </div>

        <button onClick={() => setShowGuides(!showGuides)} title="Toggle grid guides (G)"
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
            showGuides ? "border-sky-400/40 bg-sky-500/10 text-sky-300" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
          }`}
        >
          <Grid3x3 className="h-3 w-3" />গাইড
        </button>

        <button id="btn-export-png" title="Export as PNG"
          className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
        >
          <FileImage className="h-3 w-3" />PNG
        </button>

        {/* Right sidebar toggle */}
        {onToggleRight && (
          <button
            onClick={onToggleRight}
            title={rightOpen ? "প্যানেল লুকান" : "প্যানেল দেখান"}
            className={`ml-1 grid h-7 w-7 place-items-center rounded-md border transition-colors ${
              rightOpen
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryItem
// ─────────────────────────────────────────────────────────────────────────────
function HistoryItem({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = () => {
    if (entry.pageId) {
      const rk = entry.layerKey ?? (entry.rowIndex !== undefined
        ? `row:${entry.pageId}:${entry.rowIndex}` : undefined);
      useEditorStore.getState().navigateTo(entry.pageId, rk);
    }
    onClose();
  };

  const restore = (e: React.MouseEvent) => {
    e.stopPropagation();
    useHistoryStore.getState().restoreTo(entry.id);
    onClose();
  };

  const previewBefore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (countdown !== null) return;

    // Capture the current after-value so we can restore it after 5s.
    // Since we use patch-based history, we only need the single field value.
    const afterPatch: HistoryPatch = {
      field: entry.patch.field,
      layerKey: entry.patch.layerKey,
      before: entry.patch.after, // flip: after becomes "before" for restore
      after: entry.patch.before, // flip: before becomes the target
    };

    // Apply the patch in reverse (show "before" state)
    useHistoryStore.getState().applyPatchReverse(entry.patch);

    // 5-second countdown
    let c = 5;
    setCountdown(c);
    timerRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setCountdown(null);
        // Restore: apply the after-patch in reverse (which brings back the after value)
        useHistoryStore.getState().applyPatchReverse(afterPatch);
      }
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div
      className="group flex flex-col gap-1 border-b border-neutral-800/60 px-3 py-2 transition-colors hover:bg-neutral-800/40 cursor-pointer"
      onClick={navigate}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex-1 text-[11px] leading-tight text-neutral-300 line-clamp-2">
          {entry.labelBn}
        </span>
        <span className="mt-0.5 shrink-0 text-[9px] text-neutral-600">
          {relativeTime(entry.ts)}
        </span>
      </div>

      {(entry.scopeLabel || entry.pageId) && (
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-mono text-neutral-500 w-fit">
          📍 {entry.scopeLabel || `${entry.pageId}${entry.rowIndex !== undefined ? `:${entry.rowIndex}` : ""}`}
        </span>
      )}

      <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={restore}
          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
        >
          পুনরুদ্ধার
        </button>
        <button
          onClick={previewBefore}
          disabled={countdown !== null}
          className="flex items-center gap-1 rounded border border-amber-900/40 bg-amber-900/10 px-2 py-0.5 text-[10px] text-amber-500 hover:bg-amber-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {countdown !== null ? (
            <><span className="tabular-nums font-bold">{countdown}s</span> আগের দেখাচ্ছে…</>
          ) : "আগের"}
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-7 w-7 place-items-center rounded-md border border-neutral-700 bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
