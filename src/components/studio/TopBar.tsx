import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileDown, FileImage, HelpCircle, Keyboard, Layers, Sparkles, X, Zap } from "lucide-react";
import { useEditorStore } from "@/state/editorStore";
import { useHistoryStore } from "@/state/historyStore";
import { QuickPublishModal } from "./QuickPublishModal";
import { toast } from "sonner";

// ── Keyboard shortcuts reference ──────────────────────────────────────
const SHORTCUT_GROUPS = [
  {
    group: "নেভিগেশন",
    color: "#f59e0b",
    items: [
      { key: "← →", desc: "আগের / পরের পেজ" },
      { key: "Space + Drag", desc: "Canvas প্যান করুন" },
      { key: "Ctrl + Scroll", desc: "Zoom in / out" },
      { key: "[ / ]", desc: "Zoom -10% / +10%" },
      { key: "F", desc: "Fit to window (85%)" },
    ],
  },
  {
    group: "এডিটর",
    color: "#8b5cf6",
    items: [
      { key: "E", desc: "Edit mode চালু/বন্ধ" },
      { key: "V", desc: "Selection tool" },
      { key: "T", desc: "Type tool" },
      { key: "G", desc: "Grid guide দেখাও/লুকাও" },
      { key: "L", desc: "Layer panel দেখাও/লুকাও" },
      { key: "Esc", desc: "Selection clear / Edit mode বন্ধ" },
    ],
  },
  {
    group: "ইতিহাস",
    color: "#10b981",
    items: [
      { key: "Ctrl+Z", desc: "Undo" },
      { key: "Ctrl+Shift+Z", desc: "Redo" },
    ],
  },
  {
    group: "রপ্তানি",
    color: "#06b6d4",
    items: [
      { key: "Ctrl+P", desc: "Print / PDF রপ্তানি" },
    ],
  },
  {
    group: "সারি নির্বাচনে",
    color: "#f43f5e",
    items: [
      { key: "↑ ↓ ← →", desc: "সারি 1px সরান" },
      { key: "Shift + Arrow", desc: "সারি 10px সরান" },
    ],
  },
];

export function TopBar({ totalPages, totalAyat }: { totalPages: number; totalAyat: number }) {
  const editMode = useEditorStore((s) => s.editMode);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const entriesCount = useHistoryStore((s) => s.entries.length);
  const initialEntriesRef = useRef(entriesCount);

  // Track the history count when entering edit mode
  useEffect(() => {
    if (editMode) {
      initialEntriesRef.current = entriesCount;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  // Close shortcuts modal on Escape
  useEffect(() => {
    if (!shortcutsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShortcutsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcutsOpen]);

  const hasNewChanges = editMode && entriesCount > initialEntriesRef.current;

  const handlePreviewClick = () => {
    if (hasNewChanges) {
      // Data is auto-persisted via zustand/persist — just confirm with a toast
      toast.success("পরিবর্তন স্বয়ংক্রিয়ভাবে সেভ হয়েছে ✓", {
        description: "LocalStorage-এ সব পরিবর্তন সংরক্ষিত।",
        duration: 3000,
      });
    }
    setEditMode(false);
  };

  const handleExportPNG = () => {
    toast.info("PNG রপ্তানি", {
      description: "Ctrl+P → 'Save as PDF' → 'Change' → PNG। অথবা Inspector-এর Export ট্যাব থেকে।",
      duration: 5000,
    });
  };

  const handleExportPDF = () => {
    // Trigger browser print dialog (works as PDF export)
    setTimeout(() => window.print(), 100);
  };

  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-neutral-100 shadow-lg">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 text-neutral-950 shadow-md shadow-amber-900/40">
            <BookOpen className="h-4.5 w-4.5" strokeWidth={2.5} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-neutral-950">
              <span className="h-1 w-1 rounded-full bg-neutral-950" />
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-neutral-100" style={{ fontFamily: "var(--font-arabic)" }}>
              কুরআন পাবলিশার
            </span>
            <span className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">
              Professional Publishing Suite
            </span>
          </div>
        </div>

        {/* Center nav */}
        <div className="flex items-center gap-1">
          <NavPill
            icon={Layers}
            label="প্রিভিউ"
            active={!editMode}
            onClick={handlePreviewClick}
          />
          <NavPill
            icon={Sparkles}
            label="এডিটর"
            active={editMode}
            onClick={() => setEditMode(true)}
          />
          {/* Save button + auto-save (editor mode only) */}
          {editMode && <SaveControl />}
        </div>


        {/* Right stats + actions */}
        <div className="flex items-center gap-2">
          <StatBadge label="আয়াত" value={totalAyat.toLocaleString("bn-BD")} />
          <StatBadge label="পেজ" value={totalPages.toLocaleString("bn-BD")} />

          <div className="mx-1 h-5 w-px bg-neutral-800" />

          <button
            id="btn-export-png"
            onClick={handleExportPNG}
            title="PNG হিসেবে রপ্তানি করুন"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 active:scale-95"
          >
            <FileImage className="h-3.5 w-3.5" />
            PNG
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            title="PDF হিসেবে রপ্তানি করুন (Ctrl+P)"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-3.5 py-1.5 text-xs font-bold text-neutral-950 shadow-md shadow-amber-900/30 transition-all hover:from-amber-300 hover:to-amber-500 hover:shadow-lg active:scale-95"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF রপ্তানি
          </button>

          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShortcutsOpen(true)}
            title="কীবোর্ড শর্টকাট (?) "
            className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>

          <button
            id="btn-quick-publish"
            onClick={() => setPublishOpen(true)}
            title="Quick publish"
            className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
          >
            <Zap className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Modal */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShortcutsOpen(false); }}
        >
          <div className="w-[620px] max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-100">
                <Keyboard className="h-4 w-4 text-amber-400" />
                কীবোর্ড শর্টকাট
              </div>
              <button
                onClick={() => setShortcutsOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Shortcut groups */}
            <div className="grid grid-cols-2 gap-4 p-5">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.group} className="flex flex-col gap-2">
                  <h3
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: group.color }}
                  >
                    {group.group}
                  </h3>
                  <div className="flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                    {group.items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-neutral-400">{item.desc}</span>
                        <kbd className="shrink-0 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] font-mono font-bold text-neutral-200 shadow-sm">
                          {item.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-800 px-5 py-3 text-[10px] text-neutral-600 text-center">
              যেকোনো জায়গায় ক্লিক করুন বা <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-neutral-400">Esc</kbd> চাপুন বন্ধ করতে
            </div>
          </div>
        </div>
      )}

      <QuickPublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
    </>
  );
}

function NavPill({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="font-bold text-amber-300">{value}</span>
    </div>
  );
}

// ── Save control: Save button + chevron dropdown with auto-save toggle ──
import { ChevronDown, Save } from "lucide-react";
import { useOverridesStore } from "@/state/overridesStore";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function SaveControl() {
  const [dirty, setDirty] = useState(false);
  const [autoSave, setAutoSave] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("autoSave") === "true";
  });

  // Track dirty state on any override change
  useEffect(() => {
    const unsub = useOverridesStore.subscribe(() => setDirty(true));
    return () => unsub();
  }, []);

  const doSave = () => {
    // Zustand persist already writes on each change; this is a confirmation.
    try {
      localStorage.setItem("studio-save-ts", String(Date.now()));
    } catch { /* ignore */ }
    setDirty(false);
    toast.success("✅ সেভ সম্পন্ন হয়েছে");
  };

  // Auto-save interval
  useEffect(() => {
    if (!autoSave) return;
    const id = window.setInterval(doSave, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave]);

  const toggleAuto = (v: boolean) => {
    setAutoSave(v);
    try { localStorage.setItem("autoSave", String(v)); } catch { /* ignore */ }
    toast.info(v ? "🔄 অটো সেভ চালু" : "অটো সেভ বন্ধ");
  };

  return (
    <div className="ml-2 flex items-center gap-1">
      <button
        onClick={doSave}
        title="সেভ করুন"
        className="relative flex items-center gap-1.5 rounded-l-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 active:scale-95"
      >
        <Save className="h-3 w-3" />
        সেভ
        {dirty && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-neutral-950" />
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            title="সেভ অপশন"
            className="flex items-center rounded-r-lg border border-l-0 border-emerald-500/40 bg-emerald-500/10 px-1.5 py-1 text-emerald-300 hover:bg-emerald-500/20"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs">
            <span className="flex items-center gap-1.5">🔄 অটো সেভ</span>
            <Switch checked={autoSave} onCheckedChange={toggleAuto} />
          </div>
          <DropdownMenuItem onClick={doSave} className="text-xs">
            📋 ম্যানুয়াল সেভ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {autoSave && (
        <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
          অটো সেভ চালু
        </span>
      )}
    </div>
  );
}

