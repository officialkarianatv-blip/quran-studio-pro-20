## STEP 1 — `LocalOverride` টাইপে Area Text fields যোগ

পুরো PARAGRAPH_WRAP_PLAN.md (৭ steps) পড়েছি। এটি **শুধু STEP 1** এর plan — InDesign-style Area Text feature এর foundation (type definition)।

### লক্ষ্য
`LocalOverride` টাইপে দুটি optional field যোগ করা যাতে প্রতিটি layer (arabic/bangla) এ Point Text বনাম Area Text mode আলাদাভাবে store করা যায়। পরবর্তী steps (2-7) এই field দুটির উপর নির্ভর করবে।

### পরিবর্তন

**ফাইল:** `src/state/overridesStore.ts` (lines 16–32)

বর্তমান `LocalOverride` type-এর শেষে (line 31 `color?` এর পরে) দুটি নতুন field যোগ:

```typescript
export type LocalOverride = {
  // ... existing fields (dx, dy, scale, fontPx, leading, tracking,
  // vScale, hScale, baseline, align, text, color) — অপরিবর্তিত ...

  /** "point" = InDesign Point Text (nowrap, cascade to next row) [DEFAULT]
   *  "area"  = InDesign Area Text (wraps within row bounds, no cascade) */
  textMode?: "point" | "area";

  /** Area Text-এ custom frame height (px). null/undefined = auto (fit content) */
  areaHeight?: number | null;
};
```

### কেন এটাই যথেষ্ট STEP 1-এর জন্য

- `patchLocal` ইতিমধ্যে generic `Partial<Record<keyof LocalOverride, ...>>` accept করে — নতুন কোনো setter দরকার নেই।
- `persist` middleware পুরো `local` map serialize করে — নতুন field automatic persist হবে।
- `temporal` (zundo) undo/redo same map track করে — automatic কাজ করবে।
- কোনো default value, migration, বা runtime behavior change দরকার নেই — STEP 2-7 সেগুলো handle করবে।

### যা পরিবর্তন হবে না

- `MASTER_DEFAULTS`, `GlobalOverrides`, `resetScoped`, কোনো helper বা store action — কিছুই না।
- `FabricLines.tsx`, `PropertiesPanel.tsx`, `textReflow.ts`, `canvasMeasure.ts` — STEP 2-7 পর্যন্ত অপরিবর্তিত।
- কোনো reflow/render behavior — field optional এবং কোথাও read হচ্ছে না।

### Verification (Build mode-এ)

1. TypeScript build পাস হবে (নতুন optional field, breaking নয়)।
2. বিদ্যমান কোনো call site ভাঙবে না — `keyof LocalOverride` এর সাথে compatible।
3. `ov.textMode` / `ov.areaHeight` read করলে `undefined` আসবে (default Point Text behavior preserved)।

### পরবর্তী steps (এই plan-এ অন্তর্ভুক্ত নয়)

STEP 2: FabricLines Arabic/Bangla render — Area Text style
STEP 3: InlineTextEditor — wrap enable
STEP 4: PropertiesPanel — Point/Area toggle UI
STEP 5: textReflow — Area mode early return
STEP 6: canvasMeasure — calculateAreaTextHeight
STEP 7: Auto-fit Frame Height button

আপনি approve করলে আমি শুধু STEP 1 implement করব। STEP 2 এর জন্য আবার plan চাইলে জানাবেন।
