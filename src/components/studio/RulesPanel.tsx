import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import { ALL_RULE_IDS, TAJWEED_RULE_NAMES, TAJWEED_CHAR, type TopSymbolId } from "@/lib/tajweed/svgMap";
import { useTajweedRules } from "@/context/TajweedRulesContext";

export function RulesPanel() {
  const { isEnabled, setEnabled, setAll } = useTajweedRules();
  const [preview, setPreview] = useState<TopSymbolId | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
          <BookOpen className="h-3 w-3" />
          তাজবিদ রুলস (১২)
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setAll(true)}
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] hover:bg-neutral-700"
          >
            সব চালু
          </button>
          <button
            onClick={() => setAll(false)}
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] hover:bg-neutral-700"
          >
            সব বন্ধ
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {ALL_RULE_IDS.map((id) => {
          const on = isEnabled(id);
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900/60 p-1.5"
            >
              <button
                onClick={() => setPreview(id)}
                title="বড় করে দেখুন"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white p-1 hover:ring-1 hover:ring-amber-400"
              >
                <span className="tajweed-icon text-neutral-900" style={{ fontSize: 28, lineHeight: 1 }} aria-label={`Rule ${id}`}>{TAJWEED_CHAR[id]}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-neutral-200">
                  রুল {id}
                </div>
                <div className="truncate text-[10px] text-neutral-400">
                  {TAJWEED_RULE_NAMES[id]}
                </div>
              </div>
              <Toggle on={on} onChange={(v) => setEnabled(id, v)} />
            </li>
          );
        })}
      </ul>

      {preview !== null && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[80vh] max-w-[80vw] rounded-lg bg-white p-6 shadow-xl"
          >
            <button
              onClick={() => setPreview(null)}
              className="absolute right-2 top-2 rounded p-1 text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
            <span
              className="tajweed-icon mx-auto block text-neutral-900"
              style={{ fontSize: "min(60vh, 60vw)", lineHeight: 1, textAlign: "center" }}
              aria-label={`Rule ${preview}`}
            >{TAJWEED_CHAR[preview]}</span>
            <div className="mt-3 text-center text-sm font-semibold text-neutral-800">
              রুল {preview} — {TAJWEED_RULE_NAMES[preview]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-amber-500" : "bg-neutral-700"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
