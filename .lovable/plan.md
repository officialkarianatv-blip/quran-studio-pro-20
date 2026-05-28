## STEP 7 — "Auto-fit Frame Height" বাটন (Area mode)

### লক্ষ্য
Area mode UI block-এ একটি ছোট "Auto-fit" বাটন যোগ করো, যা current row + layer-এর effective text/font/width থেকে `calculateAreaTextHeight` কল করে আদর্শ `areaHeight` (px) হিসাব করে `patchLocal(selKey, { areaHeight })` সেট করবে।

### স্কোপ
শুধু `src/components/studio/PropertiesPanel.tsx` — `CharacterPanel` কম্পোনেন্ট।

### পরিবর্তন

**A. Imports (file top-এ যোগ):**
```ts
import { calculateAreaTextHeight } from "@/lib/areaTextHeight";
import { getEffectiveText } from "@/lib/textReflow";
import { useReflowStore } from "@/state/reflowStore";
import { useFont } from "@/context/FontContext";
import {
  ARTBOARD_TEXT_WIDTH,
  DEFAULT_BANGLA_FONT_FAMILY,
} from "@/lib/typographyReflow";
import { Wand2 } from "lucide-react"; // ছোট auto-fit আইকন
```
(যেগুলো ইতিমধ্যে আছে সেগুলো duplicate করো না — `layerKey`, `useOverridesStore` ইতিমধ্যে imported।)

**B. `CharacterPanel`-এ derived helpers (ov/textMode/areaHeight derivation-এর পরে, ~ line 794-এর পর):**
```ts
const { activeFamily } = useFont();
const pages = useReflowStore((s) => s.pages);
const localMap = useOverridesStore((s) => s.local);

// selKey = "layer:<pageId>:<rowIdx>:<layer>"
const parts = selKey.split(":");
const pageId = parts[1] ?? "";
const rowIdx = Number(parts[2] ?? -1);

const handleAutoFit = () => {
  if (!isReflowLayer || !layerFromKey || !pageId || rowIdx < 0) return;
  const page = pages.find((p) => p.id === pageId);
  if (!page) return;
  const text = getEffectiveText(
    pageId,
    rowIdx,
    layerFromKey as "arabic" | "bangla",
    page.lines,
    localMap,
    layerKey,
  );
  const family = layerFromKey === "arabic" ? activeFamily : DEFAULT_BANGLA_FONT_FAMILY;
  const leadingMult = leading > 0 ? leading / fontPx : 1; // leading px → multiplier
  const h = calculateAreaTextHeight({
    text,
    availableWidth: ARTBOARD_TEXT_WIDTH,
    fontFamily: family,
    fontSize: fontPx,
    leading: leadingMult,
    layer: layerFromKey as "arabic" | "bangla",
    paddingY: 4,
    minHeight: Math.ceil(fontPx * 1.2),
  });
  patchLocal(selKey, { areaHeight: h });
};
```

**C. UI — Area-mode সারিতে "Auto-fit" বাটন যোগ (lines 903-933 block এর ভিতরে, Reset RotateCcw বাটনের পাশে):**
```tsx
<button
  onClick={handleAutoFit}
  title="Auto-fit: টেক্সট অনুযায়ী উচ্চতা"
  className="text-neutral-500 hover:text-sky-400"
>
  <Wand2 className="h-3 w-3" />
</button>
```
Reset (`RotateCcw`) বাটন আগের মতোই থাকবে।

### সিদ্ধান্ত

- `availableWidth = ARTBOARD_TEXT_WIDTH` (780 - 16) — ম্যাচ করে FabricLines render-time inner width।
- Leading conversion: store-এ leading px হিসেবে থাকে (`NumInput unit="px"`); `calculateAreaTextHeight` multiplier চায়, তাই `leading / fontPx`। `leading === 0` হলে fallback `1`।
- Auto-fit সবসময় Area mode-এই দেখা যাবে (`{textMode === "area" && ...}` block-এর ভিতরে)।
- বাটন `areaHeight` null-হোক বা set-হোক সবসময় visible (Reset button-ই কেবল null হলে hide)।
- কোনো reflow trigger নয় — শুধু `patchLocal` । Area-mode rows ইতিমধ্যে STEP 5-এ cascade থেকে excluded।

### যা পরিবর্তন হবে না

- `LocalOverride` shape (STEP 1)
- FabricLines render (STEP 2)
- InlineTextEditor (STEP 3)
- Area mode UI toggle / Frame Height input (STEP 4)
- reflow engine (STEP 5)
- `areaTextHeight.ts` (STEP 6)

### Verification

1. Build পাস হবে (only PropertiesPanel touch)।
2. Manual: Arabic/Bangla row select → Properties → Text Frame Mode = Area → Wand2 বাটন click → Frame Height input অটোমেটিক একটা সংখ্যায় ভরে যাবে; বড় text হলে বেশি height, ছোট হলে কম।
3. Reset (RotateCcw) এখনো কাজ করবে — `areaHeight: null`।
