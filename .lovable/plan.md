## STEP 2 — FabricLines Arabic/Bangla display divs — Area Text style support

### লক্ষ্য
`FabricRow` কম্পোনেন্টের Arabic ও Bangla display div-এ `textMode` অনুযায়ী conditional CSS apply করা, যাতে STEP 1-এ যোগ করা `textMode: "area"` কাজ করে। STEP 3 (InlineTextEditor) এই STEP-এর পরে আসবে।

### পরিবর্তন — `src/components/studio/FabricLines.tsx`

**2A — `aOv` derived values (line ~225 এর পরে) এ যোগ:**
```typescript
const aTextMode = aOv?.textMode ?? "point";
const aAreaHeight = aOv?.areaHeight ?? null;
```

**2B — `bOv` derived values (line ~240 এর পরে) এ যোগ:**
```typescript
const bTextMode = bOv?.textMode ?? "point";
const bAreaHeight = bOv?.areaHeight ?? null;
```

**2C — Arabic display div style (lines 462, 475–476):**
- `height: L.arH` → `height: aTextMode === "area" ? (aAreaHeight ?? L.arH) : L.arH`
- `whiteSpace: "nowrap"` → `whiteSpace: aTextMode === "area" ? "normal" : "nowrap"`
- `overflow: "visible"` → `overflow: aTextMode === "area" ? "hidden" : "visible"`
- নতুন property যোগ (area mode-এ only effective):
  - `wordBreak: aTextMode === "area" ? "break-word" : undefined`
  - `overflowWrap: aTextMode === "area" ? "break-word" : undefined`
  - `direction: "rtl"` (Arabic RTL wrap-এর জন্য — ইতিমধ্যে `dir="rtl"` attribute আছে, CSS hint হিসেবে)
  - `unicodeBidi: aTextMode === "area" ? "plaintext" : undefined`

**2D — Bangla display div style (lines 583, 597):**
- `height: L.bnH` → `height: bTextMode === "area" ? (bAreaHeight ?? L.bnH) : L.bnH`
- `whiteSpace: "normal"` → `whiteSpace: bTextMode === "area" ? "normal" : "nowrap"` (Point mode-এ now nowrap, Area mode-এ wrap — Plan-এর intent অনুযায়ী)
- `overflow: "visible"` → `overflow: bTextMode === "area" ? "hidden" : "visible"`
- নতুন: `wordBreak: bTextMode === "area" ? "break-word" : "normal"`

### Bangla `whiteSpace` change নিয়ে নোট

বর্তমানে Bangla layer-এ `whiteSpace: "normal"` (অর্থাৎ default-এ visual wrap হয়)। Plan-এ Bangla Point mode-এ `"nowrap"` করতে বলা হয়েছে — এটা একটা behavior change যা existing Bangla rendering-কে প্রভাবিত করতে পারে। তবে STEP 1-7 plan-এর consistency এর জন্য (Point = nowrap+cascade, Area = wrap) এটাই সঠিক।

### যা পরিবর্তন হবে না

- InlineTextEditor (STEP 3)
- PropertiesPanel UI toggle (STEP 4)
- reflow logic (STEP 5)
- কোনো অন্য কম্পোনেন্ট

### Verification
- Build পাস হবে।
- Default (`textMode === "point"`) সবার জন্য — শুধু Bangla `whiteSpace` `normal → nowrap` হবে (intentional per plan)।
- DevTools-এ override-এ `textMode: "area"` সেট করলে div-এ wrap হবে (UI toggle STEP 4 এ আসবে; এখন শুধু render layer ready)।
