import { useRef } from "react";
import { useFont } from "@/context/FontContext";

export function FontToolbar() {
  const { fonts, activeId, setActiveId, uploadFont } = useFont();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-100">
      <span className="text-sm font-semibold tracking-wide">Studio Al-Qalam</span>
      <span className="text-xs text-neutral-400">DTP Workspace · 5 Artboards</span>
      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs text-neutral-300">Arabic font:</label>
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-100"
        >
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Upload .ttf
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
      </div>
    </div>
  );
}
