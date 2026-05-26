import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, Layers, LayoutTemplate, Type } from "lucide-react";
import { useEditorStore } from "@/state/editorStore";
import { useOverridesStore, rowKey, layerKey } from "@/state/overridesStore";
import type { PageData } from "@/data/pages";

const ROW_COUNT = 9;

const LAYER_LABELS: Record<string, { label: string; color: string }> = {
  symbol: { label: "টপ সিম্বল",  color: "#a78bfa" },
  arabic: { label: "আরবি লেখা", color: "#f59e0b" },
  bangla: { label: "বাংলা লেখা", color: "#34d399" },
};

type SubLayer = "symbol" | "arabic" | "bangla";

interface Props {
  page: PageData;
}

export function LayerPanel({ page }: Props) {
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const localMap = useOverridesStore((s) => s.local);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectRow = (i: number) => {
    const rk = rowKey(page.id, i);
    setSelection({ kind: "row", key: rk, pageId: page.id, rowIndex: i });
    setActiveTool("select");
  };

  const selectLayer = (rowIndex: number, layer: SubLayer) => {
    const lk = layerKey(page.id, rowIndex, layer);
    setSelection({ kind: "layer", key: lk, pageId: page.id, rowIndex, layerKind: layer });
    setActiveTool("type");
  };

  const isRowSelected = (i: number) => selection?.kind === "row" && selection.rowIndex === i && selection.pageId === page.id;
  const isLayerSelected = (rowIndex: number, layer: SubLayer) =>
    selection?.kind === "layer" && selection.rowIndex === rowIndex && selection.layerKind === layer && selection.pageId === page.id;

  return (
    <div className="flex flex-col gap-0.5 text-xs">

      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
        <Layers className="h-3 w-3" />
        <span>পেজ {page.footer?.pageNo ?? page.id}</span>
      </div>

      {/* Rows 1–9 */}
      {Array.from({ length: ROW_COUNT }, (_, i) => {
        const rk = rowKey(page.id, i);
        const hasLocalOv = !!localMap[rk];
        const expanded = expandedRows.has(i);
        const rowSel = isRowSelected(i);

        return (
          <div key={`row-${i}`}>
            {/* Row header */}
            <div
              className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                rowSel
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {/* Expand arrow */}
              <button
                onClick={() => toggleRow(i)}
                className="flex h-4 w-4 shrink-0 items-center justify-center text-neutral-600 hover:text-neutral-400"
              >
                {expanded
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />}
              </button>

              {/* Row click zone */}
              <div
                className="flex flex-1 items-center gap-1.5"
                onClick={() => selectRow(i)}
              >
                <LayoutTemplate className="h-3 w-3 shrink-0" />
                <span className="font-medium">সারি {i + 1}</span>
                {hasLocalOv && (
                  <span className="ml-auto rounded bg-amber-500/20 px-1 py-0.5 text-[8px] font-bold text-amber-400">edited</span>
                )}
              </div>

              {/* Visibility icon (placeholder) */}
              <Eye className="h-3 w-3 shrink-0 text-neutral-700" />
            </div>

            {/* Sub-layers */}
            {expanded && (
              <div className="ml-5 flex flex-col gap-0.5 border-l border-neutral-800 pl-2">
                {(["symbol", "arabic", "bangla"] as SubLayer[]).map((layer) => {
                  const lk = layerKey(page.id, i, layer);
                  const hasLayerOv = !!localMap[lk];
                  const layerSel = isLayerSelected(i, layer);
                  const meta = LAYER_LABELS[layer];

                  return (
                    <div
                      key={layer}
                      onClick={() => selectLayer(i, layer)}
                      className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 transition-colors ${
                        layerSel
                          ? "bg-sky-500/15 text-sky-300"
                          : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                      }`}
                    >
                      <Type className="h-2.5 w-2.5 shrink-0" style={{ color: meta.color }} />
                      <span>{meta.label}</span>
                      {hasLayerOv && (
                        <span className="ml-auto rounded bg-sky-500/20 px-1 py-0.5 text-[8px] font-bold text-sky-400">edited</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Separator */}
      <div className="my-2 border-t border-neutral-800" />

      {/* Background layer */}
      <div className="flex items-center gap-1.5 rounded px-2 py-1 text-neutral-600">
        <LayoutTemplate className="h-3 w-3 shrink-0" />
        <span>ব্যাকগ্রাউন্ড / টেমপ্লেট</span>
        <Eye className="ml-auto h-3 w-3 shrink-0" />
      </div>
    </div>
  );
}
