import { Move } from "lucide-react";
import { useEditorStore } from "@/state/editorStore";
import { useOverridesStore, useLocalOverride } from "@/state/overridesStore";

function NumField({
  label,
  value,
  onChange,
  onReset,
  unit = "px",
  step = 1,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  onReset?: () => void;
  unit?: string;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[11px] text-neutral-400">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? 0}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-right text-[11px] outline-none focus:border-amber-500"
        />
        <span className="w-6 text-[10px] text-neutral-500">{unit}</span>
        {onReset && (
          <button
            onClick={onReset}
            className="text-[9px] text-neutral-500 hover:text-amber-300"
            title="Reset"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export function TransformPanel() {
  const selection = useEditorStore((s) => s.selection);
  const scope = useEditorStore((s) => s.legacyScope);
  const local = useLocalOverride(selection?.key);

  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const clearLocal = useOverridesStore((s) => s.clearLocal);
  const global = useOverridesStore((s) => s.global);
  const setGlobal = useOverridesStore((s) => s.setGlobal);

  if (!selection) {
    return (
      <div className="mb-4 rounded border border-dashed border-neutral-800 bg-neutral-900/40 p-4 text-center text-[11px] text-neutral-500">
        Edit mode ON — click a row or symbol to transform it.
      </div>
    );
  }

  const dx = local?.dx ?? 0;
  const dy = local?.dy ?? 0;
  const localScalePct = Math.round((local?.scale ?? 1) * 100);
  const globalSymbolScalePct = Math.round((global.symbolScale ?? 1) * 100);

  const isGlobal = scope === "global";

  return (
    <div className="mb-4 rounded border border-amber-500/40 bg-neutral-900/70">
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
        <Move className="h-3 w-3" />
        Transform · {selection.kind}
        <span className="ml-auto rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[9px] text-neutral-400">
          {isGlobal ? "GLOBAL" : "LOCAL"}
        </span>
      </div>
      <div className="space-y-2 p-2.5">
        <p className="truncate font-mono text-[9px] text-neutral-500" title={selection.key}>
          {selection.key}
        </p>

        <NumField
          label="X Offset"
          value={dx}
          onChange={(v) => patchLocal(selection.key, { dx: v })}
          onReset={local?.dx !== undefined ? () => patchLocal(selection.key, { dx: undefined }) : undefined}
        />
        <NumField
          label="Y Offset"
          value={dy}
          onChange={(v) => patchLocal(selection.key, { dy: v })}
          onReset={local?.dy !== undefined ? () => patchLocal(selection.key, { dy: undefined }) : undefined}
        />

        {isGlobal && selection.kind === "symbol" ? (
          <NumField
            label="Scale"
            value={globalSymbolScalePct}
            onChange={(v) => setGlobal("symbolScale", Math.max(10, v) / 100)}
            onReset={global.symbolScale !== undefined ? () => setGlobal("symbolScale", undefined) : undefined}
            unit="%"
          />
        ) : (
          <NumField
            label="Scale"
            value={localScalePct}
            onChange={(v) => patchLocal(selection.key, { scale: Math.max(10, v) / 100 })}
            onReset={local?.scale !== undefined ? () => patchLocal(selection.key, { scale: undefined }) : undefined}
            unit="%"
          />
        )}

        {isGlobal ? (
          selection.kind === "symbol" ? null : (
            <NumField
              label="Arabic Font"
              value={global.arabicFontPx ?? 40}
              onChange={(v) => setGlobal("arabicFontPx", Math.max(8, v))}
              onReset={global.arabicFontPx !== undefined ? () => setGlobal("arabicFontPx", undefined) : undefined}
            />
          )
        ) : (
          <NumField
            label="Font Size"
            value={local?.fontPx ?? (selection.kind === "symbol" ? 14 : 40)}
            onChange={(v) => patchLocal(selection.key, { fontPx: Math.max(6, v) })}
            onReset={local?.fontPx !== undefined ? () => patchLocal(selection.key, { fontPx: undefined }) : undefined}
          />
        )}

        <button
          onClick={() => clearLocal(selection.key)}
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-800 py-1 text-[10px] text-neutral-300 hover:bg-neutral-700"
        >
          Reset all local overrides
        </button>
      </div>
    </div>
  );
}
