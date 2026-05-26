import { useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Download, Eye, EyeOff, FileText, FileType, Image as ImageIcon, Layers, Palette, Printer, RotateCcw, Sliders, Type, Upload } from "lucide-react";
import { useFont } from "@/context/FontContext";
import { useBackground } from "@/context/BackgroundContext";
import { RulesPanel } from "./RulesPanel";
import { TransformPanel } from "./TransformPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { LayerPanel } from "./LayerPanel";
import { useEditorStore } from "@/state/editorStore";
import { useOverridesStore, type GlobalOverrides } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { ARABIC_FONT_PX, BANGLA_FONT_PX } from "./FabricLines";
import type { PageData } from "@/data/pages";

const PREVIEW_TABS = [
  { id: "template", label: "টেমপ্লেট", icon: Layers },
  { id: "background", label: "ব্যাকগ্রাউন্ড", icon: ImageIcon },
  { id: "tools", label: "রুলস", icon: BookOpen },
  { id: "font", label: "ফন্ট", icon: Type },
  { id: "export", label: "Export", icon: Download },
] as const;

type PreviewTabId = (typeof PREVIEW_TABS)[number]["id"];

export function Inspector({ page }: { page?: PageData }) {
  const [previewTab, setPreviewTab] = useState<PreviewTabId>("template");
  const [editorTab, setEditorTab] = useState<"properties" | "layer">("properties");
  // Properties panel is open by default in edit mode
  const [propsPanelOpen, setPropsPanelOpen] = useState(true);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);

  return (
    <aside className="flex h-full w-full flex-col border-l border-neutral-800 bg-neutral-950 text-neutral-200">

      {/* Tabs Header */}
      <div className="flex border-b border-neutral-800 bg-neutral-900">
        {editMode ? (
          <>
            {/* Properties tab — click toggles expand/collapse */}
            <button
              onClick={() => {
                if (editorTab !== "properties") {
                  setEditorTab("properties");
                  setPropsPanelOpen(true);
                } else {
                  setPropsPanelOpen((v) => !v);
                }
              }}
              className={`flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2 text-[11px] transition-colors ${
                editorTab === "properties"
                  ? "border-amber-400 bg-neutral-950 text-amber-200"
                  : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              <Sliders className="h-3 w-3" />
              {activeTool === "type" ? "ক্যারেক্টার" : "প্রপার্টিজ"}
              {editorTab === "properties" && (
                propsPanelOpen
                  ? <ChevronUp className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                  : <ChevronDown className="h-2.5 w-2.5 ml-0.5 opacity-60" />
              )}
            </button>
            <button
              onClick={() => setEditorTab("layer")}
              className={`flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2 text-[11px] transition-colors ${
                editorTab === "layer"
                  ? "border-sky-400 bg-neutral-950 text-sky-200"
                  : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              <Layers className="h-3 w-3" />
              লেয়ার
            </button>
          </>
        ) : (
          PREVIEW_TABS.map((t) => {
            const Icon = t.icon;
            const active = previewTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setPreviewTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2 text-[11px] transition-colors ${
                  active
                    ? "border-amber-400 bg-neutral-950 text-amber-200"
                    : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })
        )}
      </div>

      {/* Tab Content */}
      {editMode ? (
        editorTab === "properties" ? (
          // Properties: only show when expanded
          propsPanelOpen ? (
            <div className="flex-1 overflow-y-auto p-3 pb-12 text-xs">
              <PropertiesPanel />
            </div>
          ) : (
            // Collapsed state: show a subtle hint
            <div className="flex items-center justify-center gap-1.5 py-3 text-[10px] text-neutral-700 cursor-pointer hover:text-neutral-500 transition-colors"
              onClick={() => setPropsPanelOpen(true)}
            >
              <ChevronDown className="h-3 w-3" />
              ক্লিক করে প্রপার্টিজ দেখুন
            </div>
          )
        ) : (
          <div className="flex-1 overflow-y-auto p-3 pb-12 text-xs">
            {page ? <LayerPanel page={page} /> : <div className="text-neutral-600 text-center pt-8">পেজ লোড হচ্ছে...</div>}
          </div>
        )
      ) : (
        <div className="flex-1 overflow-y-auto p-3 pb-12 text-xs">
          {previewTab === "template" && <TemplatePanel />}
          {previewTab === "background" && <BackgroundPanel />}
          {previewTab === "tools" && <RulesPanel />}
          {previewTab === "font" && <FontPanel />}
          {previewTab === "export" && <ExportPanel page={page} />}
        </div>
      )}
    </aside>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded border border-neutral-800 bg-neutral-900/60">
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="space-y-2 p-2.5">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, unit = "px", readOnly = false }: { label: string; value: number; onChange?: (v: number) => void; unit?: string; readOnly?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[11px] text-neutral-400">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value))}
          readOnly={readOnly}
          className={`w-16 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-right text-[11px] outline-none focus:border-amber-500 ${
            readOnly ? "cursor-not-allowed opacity-50" : ""
          }`}
        />
        <span className="w-6 text-[10px] text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function TemplatePanel() {
  const showGuides = useEditorStore((s) => s.showGuides);
  const setShowGuides = useEditorStore((s) => s.setShowGuides);

  // Actual artboard dimensions (fixed by template design)
  const ARTBOARD_W = 780;
  const ARTBOARD_H = 1170;
  const SIDE_PAD = 8;

  return (
    <div>
      <Section title="টেমপ্লেট নাম" icon={Layers}>
        <button className="w-full rounded bg-amber-500 py-1.5 text-[11px] font-semibold text-neutral-950 hover:bg-amber-400">
          মাস্টার টেমপ্লেট
        </button>
      </Section>

      <Section title="পেজ সাইজ (PX)" icon={Sliders}>
        <div className="rounded border border-neutral-800 bg-neutral-900/50 px-2.5 py-2 text-[10px] text-neutral-500 mb-1">
          আর্টবোর্ড সাইজ টেমপ্লেট দ্বারা নির্ধারিত
        </div>
        <Field label="প্রস্থ (W)" value={ARTBOARD_W} readOnly />
        <Field label="উচ্চতা (H)" value={ARTBOARD_H} readOnly />
      </Section>

      <Section title="মার্জিন (PX)" icon={Sliders}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="উপর" value={0} readOnly unit="" />
          <Field label="ডান" value={SIDE_PAD} readOnly unit="" />
          <Field label="নিচ" value={0} readOnly unit="" />
          <Field label="বাম" value={SIDE_PAD} readOnly unit="" />
        </div>
      </Section>

      <Section title="ডিজাইন এলিমেন্ট" icon={Palette}>
        <div className="flex items-center justify-between rounded bg-neutral-800/60 px-2 py-2 text-[11px]">
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">0টি এলিমেন্ট</span>
          <span className="text-neutral-500">Template Builder থেকে যোগ করুন</span>
        </div>
      </Section>

      <Section title="ডিসপ্লে" icon={Sliders}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">Slot গাইড লাইন</span>
          <button
            onClick={() => setShowGuides(!showGuides)}
            title={showGuides ? "গাইড লুকাও" : "গাইড দেখাও"}
            className={`relative flex h-5 w-9 items-center rounded-full border transition-colors ${
              showGuides
                ? "border-sky-500/60 bg-sky-500/20"
                : "border-neutral-600 bg-neutral-800"
            }`}
          >
            <span
              className={`absolute left-0.5 h-3.5 w-3.5 rounded-full shadow transition-all ${
                showGuides
                  ? "translate-x-4 bg-sky-400"
                  : "translate-x-0 bg-neutral-500"
              }`}
            />
          </button>
        </div>
      </Section>

      <Section title="অ্যারাবিক ফন্ট সাইজ" icon={Type}>
        <GlobalSlider label="আরবি ফন্ট (বেস)" k="arabicFontPx" min={20} max={80} step={1} fallback={ARABIC_FONT_PX} unit="px" />
        <GlobalSlider label="বাংলা ফন্ট" k="banglaFontPx" min={8} max={32} step={1} fallback={BANGLA_FONT_PX} unit="px" />
        <div className="my-1 border-t border-neutral-800" />
        <GlobalSlider label="আরবি Y-অফসেট" k="arabicYOffset" min={-30} max={30} step={1} fallback={0} unit="px" />
        <GlobalSlider label="বাংলা Y-অফসেট" k="banglaYOffset" min={-30} max={30} step={1} fallback={0} unit="px" />
        <GlobalSlider label="প্রতীক Y-অফসেট" k="symbolYOffset" min={-30} max={30} step={1} fallback={0} unit="px" />
      </Section>
    </div>
  );
}

function GlobalSlider({
  label,
  k,
  min,
  max,
  step = 1,
  fallback,
  unit = "px",
}: {
  label: string;
  k: keyof GlobalOverrides;
  min: number;
  max: number;
  step?: number;
  fallback: number;
  unit?: string;
}) {
  const value = useOverridesStore((s) => s.global[k]);
  const setGlobal = useOverridesStore((s) => s.setGlobal);
  const current = value ?? fallback;
  const isOverridden = value !== undefined;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={current}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setGlobal(k, Number(e.target.value))}
            className={`w-14 rounded border bg-neutral-800 px-1 py-0.5 text-right text-[10px] outline-none focus:border-amber-500 ${
              isOverridden ? "border-amber-500/70 text-amber-200" : "border-neutral-700 text-neutral-200"
            }`}
          />
          <span className="w-5 text-[9px] text-neutral-500">{unit}</span>
          <button
            onClick={() => setGlobal(k, undefined)}
            disabled={!isOverridden}
            title="রিসেট"
            className="rounded p-0.5 text-neutral-500 hover:text-amber-300 disabled:opacity-30"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => setGlobal(k, Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  );
}

function FontPanel() {
  const { fonts, activeId, setActiveId, uploadFont } = useFont();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Section title="আরবি ফন্ট নির্বাচন" icon={FileType}>
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-[11px] outline-none focus:border-amber-500"
        >
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
        >
          <Upload className="h-3 w-3" /> .ttf / .otf আপলোড
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await uploadFont(file);
            e.target.value = "";
          }}
        />
      </Section>
      <Section title="বর্তমান ফন্ট" icon={Type}>
        <div
          className="rounded border border-neutral-800 bg-neutral-900 p-3 text-center text-2xl"
          style={{ fontFamily: "var(--font-arabic)" }}
          dir="rtl"
          lang="ar"
        >
          بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
        </div>
      </Section>
    </div>
  );
}


function BackgroundPanel() {
  const { backgrounds, activeId, setActiveId, uploadBackground, activeUrl } = useBackground();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Section title="পেজ ব্যাকগ্রাউন্ড" icon={ImageIcon}>
        <div className="grid grid-cols-2 gap-2">
          {backgrounds.map((b) => {
            const active = b.id === activeId;
            return (
              <button
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={`group flex flex-col overflow-hidden rounded border text-left transition-all ${
                  active ? "border-amber-400 ring-1 ring-amber-400/60" : "border-neutral-700 hover:border-neutral-500"
                }`}
              >
                <div
                  className="aspect-[420/630] w-full bg-white"
                  style={{
                    backgroundImage: b.url ? `url("${b.url}")` : "repeating-linear-gradient(45deg,#222 0 6px,#1a1a1a 6px 12px)",
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="border-t border-neutral-800 bg-neutral-900 px-1.5 py-1 text-[10px] text-neutral-300">
                  {b.label}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
        >
          <Upload className="h-3 w-3" /> SVG / PNG ব্যাকগ্রাউন্ড আপলোড
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await uploadBackground(f);
            e.target.value = "";
          }}
        />
        <p className="pt-1 text-[10px] text-neutral-500">
          সক্রিয়: <span className="text-amber-300">{backgrounds.find((b) => b.id === activeId)?.label}</span>
        </p>
        {activeUrl && (
          <a
            href={activeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-emerald-400 underline"
          >
            SVG ফাইল দেখুন
          </a>
        )}
      </Section>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center rounded border border-dashed border-neutral-800 p-6 text-center text-[11px] text-neutral-500">
      {title} — শীঘ্রই আসছে
    </div>
  );
}

function ExportPanel({ page }: { page?: PageData }) {
  const totalPages = useReflowStore((s) => s.pages.length);
  const [exporting, setExporting] = useState(false);

  const handlePrintCurrent = () => {
    // Focus and print just the artboard area
    setExporting(true);
    setTimeout(() => {
      window.print();
      setExporting(false);
    }, 100);
  };

  const handlePrintAll = () => {
    if (!confirm(`সব ${totalPages}টি পেজ প্রিন্ট/PDF রপ্তানি করবেন?`)) return;
    setExporting(true);
    setTimeout(() => {
      window.print();
      setExporting(false);
    }, 100);
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title="বর্তমান পেজ" icon={FileText}>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5 text-[10px] text-neutral-400 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span>পেজ নম্বর</span>
            <span className="font-bold text-amber-300">{page?.footer.pageNo ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>সূরা</span>
            <span className="text-neutral-300 truncate max-w-[160px]">{page?.footer.surah ?? "—"}</span>
          </div>
        </div>
        <button
          id="btn-export-pdf"
          onClick={handlePrintCurrent}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 text-[11px] font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          {exporting ? "প্রিন্ট হচ্ছে…" : "বর্তমান পেজ প্রিন্ট/PDF"}
        </button>
      </Section>

      <Section title="সব পেজ" icon={FileText}>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5 text-[10px] text-neutral-400 mb-2">
          <div className="flex items-center justify-between">
            <span>মোট পেজ</span>
            <span className="font-bold text-amber-300">{totalPages}</span>
          </div>
        </div>
        <button
          onClick={handlePrintAll}
          disabled={exporting || totalPages === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-60 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? "প্রিন্ট হচ্ছে…" : `সব ${totalPages}টি পেজ প্রিন্ট/PDF`}
        </button>
      </Section>

      <Section title="প্রিন্ট টিপস" icon={Printer}>
        <ul className="space-y-1.5 text-[10px] text-neutral-500">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
            ব্রাউজারে PDF হিসেবে সেভ করতে "Save as PDF" সিলেক্ট করুন
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
            মুসহাফ সাইজের জন্য A4 পাপার সিলেক্ট করুন
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
            প্রিন্টের আগে জুম সাধারণত ১০০% করুন
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500/60" />
            Ctrl+P দিয়েও প্রিন্ট ডায়ালগ খোলা যাবে
          </li>
        </ul>
      </Section>
    </div>
  );
}
