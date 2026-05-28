## STEP 4 — PropertiesPanel: Point / Area Text toggle UI

### লক্ষ্য
`CharacterPanel`-এ একটি Point ↔ Area toggle এবং Area mode সক্রিয় হলে একটি "Frame Height (px)" input যোগ করো। শুধু arabic/bangla layer-এর জন্য (symbol-এ নয়)।

### পরিবর্তন — `src/components/studio/PropertiesPanel.tsx`

**4A — `CharacterPanel`-এ derived values যোগ (line ~786 এর কাছাকাছি, `align` declare-এর পরে):**
```typescript
const textMode = (ov.textMode ?? "point") as "point" | "area";
const areaHeight = ov.areaHeight ?? null;
const isReflowLayer = layerFromKey === "arabic" || layerFromKey === "bangla";
```

**4B — Paragraph Alignment block-এর পরে (line ~872 এর পরে, রিসেট button-এর আগে) নতুন UI যোগ:**
```tsx
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
```

**4C — "রিসেট লেয়ার" button-এর patch object-এ `textMode` ও `areaHeight` যোগ করো (line ~876):**
```typescript
patchLocal(selKey, {
  fontPx: undefined, leading: undefined, tracking: undefined,
  vScale: undefined, hScale: undefined, baseline: undefined, align: undefined,
  textMode: undefined, areaHeight: undefined,
})
```

### সিদ্ধান্ত

- `textMode`/`areaHeight` সবসময় **per-layer (local)** — কোনো scope/fan-out নয় (`patchScoped` নয়, `patchLocal` direct)। কারণ Area mode একটা physical frame-property, typographic value নয়।
- symbol layer-এর জন্য toggle দেখানো হবে না (`isReflowLayer` guard)।
- Area Height empty/null = auto (= `L.arH`/`L.bnH`, STEP 2-এ এটা handle করা)।
- STEP 7-এ "Auto-fit Frame Height" button যোগ হবে যা content measure করে এই `areaHeight` সেট করবে।

### যা পরিবর্তন হবে না
- `LocalOverride` type (STEP 1)
- FabricLines render layers (STEP 2)
- InlineTextEditor (STEP 3)
- reflow engine (STEP 5)
- কোনো অন্য কম্পোনেন্ট/file

### Verification
- Build পাস হবে — `patchLocal(selKey, { textMode, areaHeight })` STEP 1-এর type-extended `LocalOverride` accept করে।
- Arabic বা Bangla layer select → Character panel-এ "Text Frame Mode" toggle দেখা যাবে।
- Area select করলে height input আসবে; খালি = auto, value দিলে frame height পরিবর্তন হবে (STEP 2/3 render integration ইতিমধ্যে ready)।
