import { useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, BookOpen, Clock, Globe,
  Link2, RotateCcw, ScanLine, Type, Move
} from "lucide-react";
import { useEditorStore, type SelectionScope } from "@/state/editorStore";
import { resetToSessionBaseline, useOverridesStore, type GlobalOverrides, type LocalOverride, layerKey, patchScoped, effectiveScope, effectiveScopeForRow } from "@/state/overridesStore";
import { useHistoryStore, relativeTime } from "@/state/historyStore";
import { useReflowStore } from "@/state/reflowStore";
import { useShallow } from "zustand/react/shallow";
import { useLinkingStore } from "@/state/linkingStore";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ARABIC_FONT_PX, BANGLA_FONT_PX } from "./FabricLines";
import { isTypographyField } from "@/lib/typographyReflow";
import { getContextPageId } from "@/lib/editorContext";
import { useTypographyPatch } from "@/hooks/useTypographyPatch";
import { ScopeImpactWarningDialog } from "./ScopeImpactWarningDialog";


const SCOPE_META: Record<SelectionScope, { labelBn: string; color: string; icon: React.ElementType; desc: string }> = {
  general: { labelBn: "সাধারণ", color: "#f59e0b", icon: AlignJustify, desc: "শুধু নির্বাচিত উপাদান" },
  page:    { labelBn: "পেজ",   color: "#06b6d4", icon: ScanLine,     desc: "এই পেজের একই ধরনের সব উপাদান" },
  surah:   { labelBn: "সূরা",  color: "#8b5cf6", icon: BookOpen,     desc: "এই সূরার একই ধরনের সব উপাদান" },
  global:  { labelBn: "সকল",   color: "#10b981", icon: Globe,        desc: "সব পেজের একই ধরনের সব উপাদান" },
};
const SCOPES: SelectionScope[] = ["general", "page", "surah", "global"];

type LinkLayer = "arabic" | "bangla" | "symbol";
const KEY_TO_LAYER: Partial<Record<keyof GlobalOverrides, LinkLayer>> = {
  arabicFontPx: "arabic",
  arabicYOffset: "arabic",
  banglaFontPx: "bangla",
  banglaYOffset: "bangla",
  symbolYOffset: "symbol",
};


type Tab = "controls" | "history";

export function PropertiesPanel() {
  const scope = useEditorStore((s) => s.scope);
  const setScope = useEditorStore((s) => s.setScope);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const activeTool = useEditorStore((s) => s.activeTool);
  const [tab, setTab] = useState<Tab>("controls");
  const isTypeTool = activeTool === "type";
  const isLayerSel = selection?.kind === "layer";

  const meta = SCOPE_META[scope];
  const { applyTypography, dialogProps: typographyDialogProps } = useTypographyPatch();

  return (
    <div className="flex flex-col gap-4">

      {/* ── Word Panel (per-word typography) ── */}
      {selection?.kind === "word" && (
        <WordPanel selKey={selection.key} pageId={selection.pageId} rowIndex={selection.rowIndex} wordIndex={selection.wordIndex ?? 0} scope={scope} />
      )}

      {/* ── Sub-Layer Movement Panel (per-row Symbol/Arabic/Bangla dy) ── */}
      {!isTypeTool && selection && (selection.kind === "row" || selection.kind === "layer") && (
        <SubLayerPanel pageId={selection.pageId} rowIndex={selection.rowIndex} scope={scope} />
      )}

      {/* ── Linking Panel ── */}
      {selection && (selection.kind === "row" || selection.kind === "layer") && (
        <LinkingPanel />
      )}

      {/* ── Character & Paragraph Panel (Type Tool only) ── */}
      {isTypeTool && isLayerSel && selection && (
        <CharacterPanel selKey={selection.key} applyTypography={applyTypography} />
      )}
      {/* ── Tabs (Controls / History) ── */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <TabBtn active={tab === "controls"} onClick={() => setTab("controls")} color={meta.color}>
          ⚙ নিয়ন্ত্রণ
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} color={meta.color}>
          <Clock className="h-2.5 w-2.5 inline mr-1" />ইতিহাস
        </TabBtn>
      </div>

      {/* ── Scope Selector ── */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          প্রয়োগ স্তর
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {SCOPES.map((s) => {
            const m = SCOPE_META[s];
            const SI = m.icon;
            const active = scope === s;
            return (
              <button key={s} onClick={() => setScope(s)}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold transition-all"
                style={active
                  ? { background: `${m.color}22`, border: `1px solid ${m.color}50`, color: m.color }
                  : { background: "#171717", border: "1px solid #262626", color: "#737373" }
                }
              >
                <SI className="h-3 w-3" />
                {m.labelBn}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selection Info Bar ── */}
      {selection && (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-400">বর্তমান নির্বাচন</span>
            <button onClick={() => setSelection(null)} className="text-red-400 hover:text-red-300">Deselect</button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-300">{selection.kind}</span>
            <span className="text-amber-400 font-mono truncate">{selection.key}</span>
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div className="pt-2">
        {tab === "controls" ? (
          <ControlsTab color={meta.color} scope={scope} applyTypography={applyTypography} />
        ) : (
          <HistoryTab />
        )}
      </div>
      <ScopeImpactWarningDialog {...typographyDialogProps} />
    </div>
  );
}

function TabBtn({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all border"
      style={active 
        ? { background: `${color}15`, color, borderColor: `${color}40` } 
        : { background: "transparent", color: "#737373", borderColor: "transparent" }}
    >
      {children}
    </button>
  );
}

type TypographyApply = ReturnType<typeof useTypographyPatch>["applyTypography"];

function ControlsTab({
  color,
  scope,
  applyTypography,
}: {
  color: string;
  scope: SelectionScope;
  applyTypography: TypographyApply;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Group title="আরবি ফন্ট" icon={Type} color={color}>
        <DSlider k="arabicFontPx" localField="fontPx" label="সাইজ" min={20} max={80} fallback={ARABIC_FONT_PX} color={color} applyTypography={applyTypography} />
        <DSlider k="arabicYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} applyTypography={applyTypography} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <Group title="বাংলা ফন্ট" icon={Type} color={color}>
        <DSlider k="banglaFontPx" localField="fontPx" label="সাইজ" min={8} max={32} fallback={BANGLA_FONT_PX} color={color} applyTypography={applyTypography} />
        <DSlider k="banglaYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} applyTypography={applyTypography} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <Group title="প্রতীক" icon={BookOpen} color={color}>
        <DSlider k="symbolYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} applyTypography={applyTypography} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <Group title="ট্রান্সফর্ম" icon={Move} color={color}>
        <LocalFields color={color} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <Group title="ইতিহাস" icon={RotateCcw} color={color}>
        <ResetGroup />
      </Group>
    </div>
  );
}



function HistoryTab() {
  const entries = useHistoryStore(useShallow((s) => s.sessionEntries()));
  const restoreTo = useHistoryStore((s) => s.restoreTo);
  const clear = useHistoryStore((s) => s.clear);
  const navigateTo = useEditorStore((s) => s.navigateTo);
  const reversed = [...entries].reverse();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <span className="text-[10px] font-semibold text-neutral-400">
          {entries.length} ধাপ রেকর্ড হয়েছে
        </span>
        {entries.length > 0 && (
          <>
            <button onClick={() => setOpen(true)}
              className="text-[10px] font-medium text-red-500/60 hover:text-red-400">সব মুছুন</button>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>সব ইতিহাস মুছবেন?</AlertDialogTitle>
                  <AlertDialogDescription>
                    আপনি কি সব ইতিহাস মুছতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>বাতিল</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clear()} className="bg-red-600 hover:bg-red-700 text-white">
                    হ্যাঁ, মুছুন
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
      {reversed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-neutral-600 text-[11px] text-center">
          <Clock className="h-6 w-6 mb-2 opacity-30" />
          কোনো পরিবর্তন নেই।<br/>এডিট মোডে কিছু পরিবর্তন করুন।
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reversed.map((entry) => {
            const m = SCOPE_META[entry.scope] ?? SCOPE_META.global;
            const goToEntry = () => {
              if (!entry.pageId) return;
              const rk =
                entry.layerKey ??
                (entry.rowIndex !== undefined
                  ? `row:${entry.pageId}:${entry.rowIndex}`
                  : undefined);
              navigateTo(entry.pageId, rk);
            };

            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={goToEntry}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToEntry();
                  }
                }}
                className="flex flex-col gap-1 rounded bg-neutral-900/50 p-2 group hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${m.color}20`, color: m.color }}>
                    {m.labelBn}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {entry.scopeLabel && (
                      <span className="rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-400">
                        {entry.scopeLabel}
                      </span>
                    )}
                    <span className="text-[9px] text-neutral-500">{relativeTime(entry.ts)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-300 truncate">{entry.labelBn}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreTo(entry.id);
                    }}
                    className="shrink-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[9px] text-neutral-400 opacity-0 group-hover:opacity-100 hover:border-amber-500/40 hover:text-amber-300 transition-all"
                  >
                    পুনরুদ্ধার
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Group({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        <Icon className="h-3.5 w-3.5" />{title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function DSlider({ k, localField, label, min, max, fallback, color, applyTypography }: {
  k: keyof GlobalOverrides;
  localField?: keyof LocalOverride;
  label: string;
  min: number;
  max: number;
  fallback: number;
  color: string;
  applyTypography: TypographyApply;
}) {
  const stored = useOverridesStore((s) => s.global[k]);
  const setGlobal = useOverridesStore((s) => s.setGlobal);
  const scope = useEditorStore((s) => s.scope);
  const selection = useEditorStore((s) => s.selection);
  const [dragging, setDragging] = useState<number | null>(null);

  const selKey = selection?.key ?? null;
  const localOverride = useOverridesStore((s) => (selKey ? s.local[selKey] : undefined));
  const localValue =
    localField && localOverride
      ? (localOverride[localField] as number | undefined)
      : undefined;

  const isLocalScope = scope !== "global" && selKey !== null && localField !== undefined;

  const effectiveValue = isLocalScope
    ? (localValue ?? stored ?? fallback)
    : (stored ?? fallback);
  const display = dragging ?? effectiveValue;

  const isOverridden = isLocalScope ? localValue !== undefined : stored !== undefined;

  // Layer this slider semantically targets — drives the linking gate.
  const layerForGate: LinkLayer | null = KEY_TO_LAYER[k] ?? (selection?.layerKind as LinkLayer | undefined) ?? null;
  const linked = useLinkingStore((s) => (layerForGate ? s[layerForGate] : false));
  const willFanOut = isLocalScope && linked;

  const isTypoLocal =
    isLocalScope &&
    localField === "fontPx" &&
    layerForGate !== null &&
    (layerForGate === "arabic" || layerForGate === "bangla");

  const applyValue = (v: number) => {
    setDragging(null);
    if (!isLocalScope) {
      setGlobal(k, v);
    } else if (isTypoLocal) {
      applyTypography(selKey!, { fontPx: v }, scope, layerForGate);
    } else {
      void (async () => {
        const eff = await effectiveScope(scope, layerForGate);
        void patchScoped(selKey!, { [localField!]: v } as never, eff);
      })();
    }
  };

  const resetValue = () => {
    setDragging(null);
    if (!isLocalScope) {
      setGlobal(k, undefined);
    } else if (isTypoLocal) {
      applyTypography(selKey!, { fontPx: undefined }, scope, layerForGate);
    } else {
      void (async () => {
        const eff = await effectiveScope(scope, layerForGate);
        void patchScoped(selKey!, { [localField!]: undefined } as never, eff);
      })();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
          {label}
          {isLocalScope && layerForGate && (
            <Link2
              className="h-2.5 w-2.5"
              style={{ color: willFanOut ? "#a78bfa" : "#404040" }}
              aria-label={willFanOut ? "fan-out enabled" : "local only"}
            />
          )}
        </span>
        <div className="flex items-center gap-1">
          <input type="number" value={display}
            onChange={(e) => applyValue(Number(e.target.value))}
            className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-right text-[11px] font-mono outline-none focus:border-amber-400"
            style={{ color: isOverridden ? color : "#737373" }} step={1} min={min} max={max} />
          {isOverridden && (
            <button onClick={resetValue} className="ml-1 text-neutral-600 hover:text-amber-400" title="Reset">
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <input type="range" min={min} max={max} value={display}
        onInput={(e) => setDragging(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => applyValue(Number((e.target as HTMLInputElement).value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color, background: `linear-gradient(to right, ${color} ${((display - min) / (max - min)) * 100}%, #262626 0%)` }}
      />
    </div>
  );
}



function LocalFields({ color }: { color: string }) {
  const selection = useEditorStore((s) => s.selection);
  const scope = useEditorStore((s) => s.scope);
  const local = useOverridesStore((s) => selection ? s.local[selection.key] : undefined);
  // ⚠️ All hooks MUST be called before any early return (React rules of hooks)
  const link = useLinkingStore();

  if (!selection) return <div className="text-[10px] text-neutral-600 rounded bg-neutral-900/50 p-2 text-center">ট্রান্সফর্ম করার জন্য সারি নির্বাচন করুন</div>;

  const layerKind = selection.layerKind ?? null;
  const willFanOut =
    scope !== "general" &&
    (layerKind ? link[layerKind] : link.arabic && link.bangla && link.symbol);
  const apply = (patch: Record<string, unknown>) => {
    void (async () => {
      const eff = layerKind
        ? await effectiveScope(scope, layerKind)
        : await effectiveScopeForRow(scope);
      void patchScoped(selection.key, patch as never, eff);
    })();
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {(["dx", "dy"] as const).map((f) => (
        <div key={f} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-neutral-500" style={{ color }}>
              {f === "dx" ? "X অফসেট" : "Y অফসেট"}
              <Link2 className="h-2.5 w-2.5" style={{ color: willFanOut ? "#a78bfa" : "#404040" }} />
            </span>

            {(local?.[f] ?? 0) !== 0 && (
              <button onClick={() => apply({ [f]: undefined })} className="text-neutral-600 hover:text-amber-400">
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          <input type="number" value={local?.[f] ?? 0}
            onChange={(e) => apply({ [f]: Number(e.target.value) || undefined })}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] outline-none focus:border-amber-400"
            step={1} />
        </div>
      ))}
    </div>
  );
}

const SCOPE_RESET_TEXT: Record<SelectionScope, string> = {
  general: "এই নির্বাচনের সেটিং রিসেট হবে।",
  page: "এই পেজের সব সেটিং রিসেট হবে।",
  surah: "এই সূরার সব সেটিং রিসেট হবে।",
  global: "সম্পূর্ণ মুসহাফের সব সেটিং রিসেট হবে ⚠️",
};

function ResetGroup() {
  const resetScoped = useOverridesStore((s) => s.resetScoped);
  const rebuild = useReflowStore((s) => s.rebuild);
  const scope = useEditorStore((s) => s.scope);
  const selection = useEditorStore((s) => s.selection);
  const [open, setOpen] = useState(false);

  const doReset = () => {
    setOpen(false);
    useReflowStore.setState({ buildProgress: { label: "রিসেট হচ্ছে…", pct: 50 } });
    void (async () => {
      if (scope === "global") {
        resetToSessionBaseline();
      } else {
        await resetScoped(scope, {
          key: selection?.key,
          pageId: getContextPageId(),
        });
      }
      useEditorStore.getState().setPendingReflow(null);
      rebuild();
      useOverridesStore.temporal.getState().clear();
      useHistoryStore.getState().clear();
      useReflowStore.setState({ buildProgress: null });
    })();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => useOverridesStore.temporal.getState().undo()}
          className="flex items-center justify-center gap-1 rounded border border-neutral-700 bg-neutral-900 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800">
          <RotateCcw className="h-3 w-3" /> Undo
        </button>
        <button onClick={() => useOverridesStore.temporal.getState().redo()}
          className="flex items-center justify-center gap-1 rounded border border-neutral-700 bg-neutral-900 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800">
          <RotateCcw className="h-3 w-3 scale-x-[-1]" /> Redo
        </button>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-red-900/40 bg-red-900/10 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-900/20 mt-2">
        সব রিসেট করুন
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>সব রিসেট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              আপনি কি সব সেটিং রিসেট করতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।
              <br />
              <span className={scope === "global" ? "text-red-400 font-semibold" : "text-neutral-400"}>
                {SCOPE_RESET_TEXT[scope]}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doReset} className="bg-red-600 text-white hover:bg-red-700">
              হ্যাঁ, রিসেট করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SubLayerPanel — per-row Symbol/Arabic/Bengali independent Y-offset
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SubLayer = "symbol" | "arabic" | "bangla";
const SUB_META: Record<SubLayer, { label: string; icon: string; color: string }> = {
  symbol: { label: "প্রতীক", icon: "🔣", color: "#10b981" },
  arabic: { label: "আরবি", icon: "ع", color: "#f59e0b" },
  bangla: { label: "বাংলা", icon: "ক", color: "#06b6d4" },
};

function SubLayerPanel({ pageId, rowIndex, scope }: { pageId: string; rowIndex: number; scope: SelectionScope }) {
  const [active, setActive] = useState<SubLayer>("arabic");
  const link = useLinkingStore();
  const key = layerKey(pageId, rowIndex, active);
  const dy = useOverridesStore((s) => s.local[key]?.dy ?? 0);

  const apply = (v: number | undefined) => {
    void (async () => {
      const linked = link[active];
      if (linked) {
        const eff = await effectiveScope(scope, active);
        await patchScoped(key, { dy: v }, eff);
      } else {
        useOverridesStore.getState().patchLocal(key, { dy: v });
      }
    })();
  };

  const meta = SUB_META[active];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
        <Move className="h-3 w-3" /> সাব-লেয়ার মুভমেন্ট
      </div>

      <div className="flex gap-1">
        {(Object.keys(SUB_META) as SubLayer[]).map((k) => {
          const m = SUB_META[k];
          const isActive = active === k;
          return (
            <button
              key={k}
              onClick={() => setActive(k)}
              className="flex-1 rounded px-2 py-1.5 text-[11px] font-semibold transition-all border"
              style={isActive
                ? { background: `${m.color}22`, borderColor: `${m.color}50`, color: m.color }
                : { background: "#171717", borderColor: "#262626", color: "#737373" }}
            >
              <span className="mr-1">{m.icon}</span>{m.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-medium text-neutral-400">
            Y অফসেট ({meta.label})
            {link[active] && <span className="ml-1 text-emerald-400" title="লিংক চালু">🔗</span>}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={dy}
              onChange={(e) => apply(Number(e.target.value) || undefined)}
              className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-right text-[11px] font-mono outline-none focus:border-amber-400"
              style={{ color: dy !== 0 ? meta.color : "#737373" }}
              step={1} min={-30} max={30}
            />
            {dy !== 0 && (
              <button onClick={() => apply(undefined)} className="ml-1 text-neutral-600 hover:text-amber-400" title="Reset">
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <input
          type="range" min={-30} max={30} step={1} value={dy}
          onChange={(e) => apply(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: meta.color }}
        />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LinkingPanel — toggle scope-aware link for each sub-layer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function LinkingPanel() {
  const { arabic, bangla, symbol, setLink, setAll } = useLinkingStore();
  const scope = useEditorStore((s) => s.scope);
  const scopeMeta = SCOPE_META[scope];
  const allOn = arabic && bangla && symbol;

  const layerHints: Record<"arabic" | "bangla" | "symbol", { on: string; off: string }> = {
    arabic: {
      on: "টাইপোগ্রাফি বদলালে লিংকড সারিতে auto reflow",
      off: "শুধু এই সারিতেই reflow; ওভারফ্লো clip হবে",
    },
    bangla: {
      on: "টাইপোগ্রাফি বদলালে লিংকড সারিতে auto reflow",
      off: "শুধু এই সারিতেই reflow; ওভারফ্লো clip হবে",
    },
    symbol: {
      on: "প্রতীক লেয়ারে টেক্সট reflow নেই",
      off: "প্রতীক লেয়ারে টেক্সট reflow নেই",
    },
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-violet-400">
          <span className="flex items-center gap-1.5"><Link2 className="h-3 w-3" /> এরিয়া টেক্সট লিংক</span>
        <button
          onClick={() => setAll(!allOn)}
          className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-300 hover:bg-violet-500/20"
        >
          {allOn ? "সব আন-লিংক" : "সব লিংক"}
        </button>
        </div>
        <p className="text-[9px] text-neutral-500 leading-snug">
          InDesign Area Text: লিংক ON হলে স্কোপ অনুযায়ী ওভারফ্লো পরের সারি/পেজে যায়।
        </p>
      </div>

      {([
        ["arabic", "আরবি লিংক", arabic],
        ["bangla", "বাংলা লিংক", bangla],
        ["symbol", "প্রতীক লিংক", symbol],
      ] as const).map(([k, label, on]) => {
        const hint = layerHints[k][on ? "on" : "off"];

        return (
          <label
            key={k}
            className="flex flex-col gap-1 rounded px-2 py-1.5 cursor-pointer transition-all"
            style={
              on
                ? { background: `${scopeMeta.color}10`, boxShadow: `inset 0 0 0 1px ${scopeMeta.color}55` }
                : { background: "rgba(23,23,23,0.6)" }
            }
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                <span style={{ opacity: on ? 1 : 0.4 }}>{on ? "🔗" : "⛓️‍💥"}</span>
                {label}
                {on && (
                  <span
                    className="ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ background: `${scopeMeta.color}22`, color: scopeMeta.color }}
                  >
                    {scopeMeta.labelBn}
                  </span>
                )}
              </span>
              <Switch checked={on} onCheckedChange={(v) => setLink(k, v)} />
            </span>
            <span className="text-[9px] text-neutral-500 pl-5">{hint}</span>
          </label>
        );
      })}

    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Character & Paragraph Panel (Type Tool mode)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NumInput({
  label, value, onChange, unit = "pt", min, max, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-neutral-600 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-0.5 rounded border border-neutral-700 bg-neutral-900">
        <button
          onMouseDown={(e) => { e.preventDefault(); onChange(Math.max(min ?? -999, value - step)); }}
          className="px-1.5 py-1 text-neutral-500 hover:text-neutral-200 transition-colors select-none"
        >−</button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-12 bg-transparent text-center text-[11px] font-mono text-neutral-200 outline-none"
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); onChange(Math.min(max ?? 9999, value + step)); }}
          className="px-1.5 py-1 text-neutral-500 hover:text-neutral-200 transition-colors select-none"
        >+</button>
      </div>
      {unit && <span className="text-[8px] text-neutral-700">{unit}</span>}
    </div>
  );
}

function CharacterPanel({
  selKey,
  applyTypography,
}: {
  selKey: string;
  applyTypography: TypographyApply;
}) {
  const localMap = useOverridesStore((s) => s.local);
  const globalArabicFontPx = useOverridesStore((s) => s.global.arabicFontPx);
  const globalBanglaFontPx = useOverridesStore((s) => s.global.banglaFontPx);
  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const scope = useEditorStore((s) => s.scope);
  const ov = localMap[selKey] ?? {};

  const isArabicLayer = selKey.includes(":arabic");
  const globalFontFallback = isArabicLayer
    ? (globalArabicFontPx ?? ARABIC_FONT_PX)
    : (globalBanglaFontPx ?? BANGLA_FONT_PX);

  const fontPx   = ov.fontPx   ?? globalFontFallback;
  const leading  = ov.leading  ?? 0;
  const tracking = ov.tracking ?? 0;
  const vScale   = ov.vScale   ?? 100;
  const hScale   = ov.hScale   ?? 100;
  const baseline = ov.baseline ?? 0;
  const align    = ov.align    ?? "justify";
  const textMode = (ov.textMode ?? "point") as "point" | "area";
  const areaHeight = ov.areaHeight ?? null;

  // selKey looks like "layer:<pageId>:<rowIdx>:<arabic|bangla|symbol>"
  const layerFromKey = (selKey.split(":")[3] ?? null) as LinkLayer | null;
  const linked = useLinkingStore((s) => (layerFromKey ? s[layerFromKey] : false));
  const willFanOut = scope !== "general" && linked;
  const isReflowLayer = layerFromKey === "arabic" || layerFromKey === "bangla";

  const set = (k: string, v: number | string) => {
    if (
      isTypographyField(k) &&
      layerFromKey &&
      (layerFromKey === "arabic" || layerFromKey === "bangla")
    ) {
      applyTypography(selKey, { [k]: v } as never, scope, layerFromKey);
      return;
    }
    // align, baseline, vScale, etc. — always this layer only (no linking fan-out)
    patchLocal(selKey, { [k]: v } as never);
  };


  const ALIGN_OPTIONS = [
    { value: "left",    icon: AlignLeft,    label: "বাম" },
    { value: "center",  icon: AlignCenter,  label: "মধ্য" },
    { value: "right",   icon: AlignRight,   label: "ডান" },
    { value: "justify", icon: AlignJustify, label: "জাস্ট" },
  ] as const;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
        <Type className="h-3 w-3" />
        ক্যারেক্টার
        {layerFromKey && (
          <Link2
            className="h-2.5 w-2.5"
            style={{ color: willFanOut ? "#a78bfa" : "#404040" }}
            aria-label={willFanOut ? "fan-out enabled" : "local only"}
          />
        )}
      </div>

      {/* Row 1: Font size + Leading */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Font Size" value={fontPx} unit="px" min={6} max={200}
          onChange={(v) => set("fontPx", v)} />
        <NumInput label="Leading" value={leading} unit="px" min={0} max={200}
          onChange={(v) => set("leading", v)} />
      </div>

      {/* Row 2: Tracking + Baseline */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Tracking" value={tracking} unit="px" min={-100} max={200} step={0.5}
          onChange={(v) => set("tracking", v)} />
        <NumInput label="Baseline" value={baseline} unit="px" min={-100} max={100} step={0.5}
          onChange={(v) => set("baseline", v)} />
      </div>

      {/* Row 3: Vertical scale + Horizontal scale */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="V Scale" value={vScale} unit="%" min={10} max={300}
          onChange={(v) => set("vScale", v)} />
        <NumInput label="H Scale" value={hScale} unit="%" min={10} max={300}
          onChange={(v) => set("hScale", v)} />
      </div>

      {/* Paragraph Alignment */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[9px] text-neutral-600 uppercase tracking-wider">Paragraph Align</span>
        <div className="flex gap-1">
          {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => set("align", value)}
              title={label}
              className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-all ${
                align === value
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Text Frame Mode (Point / Area) — Arabic & Bangla layers only */}
      {isReflowLayer && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] text-neutral-600 uppercase tracking-wider">
            Text Frame Mode
          </span>
          <div className="flex gap-1">
            {([
              { value: "point", label: "Point", title: "Point Text — পরের সারিতে ক্যাসকেড" },
              { value: "area",  label: "Area",  title: "Area Text — ফ্রেমে wrap, ক্যাসকেড নেই" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => patchLocal(selKey, { textMode: opt.value })}
                title={opt.title}
                className={`flex flex-1 items-center justify-center rounded border py-1.5 text-[10px] font-semibold transition-all ${
                  textMode === opt.value
                    ? "border-sky-500/60 bg-sky-500/15 text-sky-300"
                    : "border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {textMode === "area" && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 flex-shrink-0">
                Frame Height
              </span>
              <input
                type="number"
                min={10}
                max={2000}
                step={1}
                value={areaHeight ?? ""}
                placeholder="auto"
                onChange={(e) => {
                  const raw = e.target.value;
                  const v = raw === "" ? null : Number(raw);
                  patchLocal(selKey, { areaHeight: v === null || Number.isNaN(v) ? null : v });
                }}
                className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-[11px] font-mono outline-none focus:border-sky-400"
              />
              <span className="text-[10px] text-neutral-500">px</span>
              {areaHeight != null && (
                <button
                  onClick={() => patchLocal(selKey, { areaHeight: null })}
                  title="Auto (row height)"
                  className="text-neutral-600 hover:text-sky-400"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reset layer overrides */}
      <button
        onClick={() => patchLocal(selKey, { fontPx: undefined, leading: undefined, tracking: undefined, vScale: undefined, hScale: undefined, baseline: undefined, align: undefined, textMode: undefined, areaHeight: undefined })}
        className="mt-1 rounded border border-neutral-700 bg-neutral-900 py-1 text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
      >
        রিসেট লেয়ার
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Word Panel — per-word typography (Plan 10)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { splitArabicWords } from "@/lib/wordSplit";
import { useLargeChangeGuard } from "@/hooks/useLargeChangeGuard";

function WordPanel({
  selKey, pageId, rowIndex, wordIndex, scope,
}: {
  selKey: string; pageId: string; rowIndex: number; wordIndex: number; scope: SelectionScope;
}) {
  const ov = useOverridesStore((s) => s.local[selKey]);
  const pages = useReflowStore((s) => s.pages);
  const globalArabicFontPx = useOverridesStore((s) => s.global.arabicFontPx);
  const { request, dialogProps } = useLargeChangeGuard();

  const row = pages.find((p) => p.id === pageId)?.lines?.[rowIndex] as { arabic?: string } | undefined;
  const words = splitArabicWords(row?.arabic ?? "");
  const wordText = words[wordIndex] ?? "";

  const fallbackFont = globalArabicFontPx ?? ARABIC_FONT_PX;
  const fontPx   = ov?.fontPx   ?? fallbackFont;
  const tracking = ov?.tracking ?? 0;
  const color    = ov?.color    ?? "#111827";

  const apply = (patch: Record<string, unknown>) => {
    // Estimate affected count for surah/global to feed the guard dialog UI.
    const estimate = scope === "general" ? 1 : scope === "page"
      ? words.filter((w) => w === wordText).length
      : 50; // rough hint — actual fan-out runs inside patchScoped
    request({
      scope,
      estimatedRows: estimate,
      label: "শব্দ স্টাইল প্রয়োগ হচ্ছে…",
      action: () => patchScoped(selKey, patch as never, scope),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
          <span className="flex items-center gap-1.5"><Type className="h-3 w-3" /> নির্বাচিত শব্দ</span>
          <span
            className="font-normal text-amber-200 truncate max-w-[60%] text-[14px]"
            style={{ fontFamily: "var(--font-arabic)" }}
            dir="rtl"
            lang="ar"
          >
            {wordText}
          </span>
        </div>

        {/* Font size */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">ফন্ট সাইজ</span>
            <div className="flex items-center gap-1">
              <input type="number" value={fontPx} min={12} max={96} step={1}
                onChange={(e) => apply({ fontPx: Number(e.target.value) })}
                className="w-14 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-right text-[11px] font-mono outline-none focus:border-amber-400" />
              {ov?.fontPx !== undefined && (
                <button onClick={() => apply({ fontPx: undefined })} className="text-neutral-600 hover:text-amber-400" title="Reset">
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <input type="range" min={12} max={96} step={1} value={fontPx}
            onChange={(e) => apply({ fontPx: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>

        {/* Letter spacing */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Letter Spacing</span>
            <div className="flex items-center gap-1">
              <input type="number" value={tracking} min={-2} max={8} step={0.5}
                onChange={(e) => apply({ tracking: Number(e.target.value) })}
                className="w-14 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-right text-[11px] font-mono outline-none focus:border-amber-400" />
              {ov?.tracking !== undefined && (
                <button onClick={() => apply({ tracking: undefined })} className="text-neutral-600 hover:text-amber-400" title="Reset">
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <input type="range" min={-2} max={8} step={0.5} value={tracking}
            onChange={(e) => apply({ tracking: Number(e.target.value) })}
            className="w-full accent-amber-500" />
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">রং</span>
            {ov?.color !== undefined && (
              <button onClick={() => apply({ color: undefined })} className="text-neutral-600 hover:text-amber-400" title="Reset">
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => apply({ color: e.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-900"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => apply({ color: e.target.value })}
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-mono outline-none focus:border-amber-400"
              placeholder="#111827"
            />
          </div>
        </div>
      </div>
      <ScopeImpactWarningDialog {...dialogProps} />
    </>
  );
}

