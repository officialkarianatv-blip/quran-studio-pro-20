## STEP 5 — Reflow engine: skip Area-mode rows

### লক্ষ্য
`reflowFrom`, `reflowFromAsync`, `backFillFrom`, ও `planCascade` — সবগুলো cascade পথে যেকোনো row যার layer override-এ `textMode === "area"` সেট আছে, সেটি **skip** করবে। Area row independent frame হিসেবে আচরণ করে — তার text পরিবর্তন হবে না, পরবর্তী/পূর্ববর্তী row থেকে কোনো text এতে পুশ/পুল হবে না; cascade তার উপর দিয়ে jump করে পরবর্তী non-area row-এ যাবে।

### পরিবর্তন — `src/lib/textReflow.ts`

**5A — File-level helper যোগ করো (line ~24 এর কাছাকাছি, `measureTextWidth` declare-এর আগে):**
```typescript
/** True if the given layer at (pageId, rowIndex) is in Area Text mode
 *  (independent frame — must be skipped by cascade/back-fill). */
function isAreaLayer(
  pageId: string,
  rowIndex: number,
  layer: LayerKind,
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pid: string, ri: number, l: LayerKind) => string,
): boolean {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  return localMap[lk]?.textMode === "area";
}
```

**5B — `reflowFrom` (line 118 এর inner row loop):** row-iteration শুরুতে guard যোগ করো:
```typescript
for (let ri = firstRow; ri < page.lines.length; ri++) {
  // Skip Area-mode rows entirely — they are independent frames.
  if (
    !(pi === startPageIdx && ri === startRowIndex) && // start row already written by caller
    isAreaLayer(page.id, ri, layer, localMap, layerKeyFn)
  ) continue;
  // ... existing body unchanged ...
}
```

**5C — `reflowFromAsync` (line 181 এর inner row loop):** একই guard যোগ করো (same condition)।

**5D — `backFillFrom` (line ~268 এর "next row" lookup):** next row resolve করার পরে, যদি next row area-mode হয় তাহলে jump:
```typescript
// Find next row (same page, else next page row 0).
let nPi = pi;
let nRi = ri + 1;
if (nRi >= curPage.lines.length) { nPi = pi + 1; nRi = 0; }
if (nPi >= targetPages.length) break;

// Skip past Area-mode next rows — they don't donate text.
while (
  nPi < targetPages.length &&
  targetPages[nPi] &&
  nRi < targetPages[nPi].lines.length &&
  isAreaLayer(targetPages[nPi].id, nRi, layer, localMap, layerKeyFn)
) {
  nRi += 1;
  if (nRi >= targetPages[nPi].lines.length) { nPi += 1; nRi = 0; }
}
if (nPi >= targetPages.length) break;
const nextPage = targetPages[nPi];
if (!nextPage || nextPage.lines.length === 0) break;
```
এতে যদি current row `ri`-ও area হয় (defensive) — uppermost caller থেকেই এই function call হওয়ার আগে সাধারণত area row থেকে back-fill trigger হবে না, কিন্তু extra safety-এর জন্য function-এর শুরুতে যোগ করো:
```typescript
if (isAreaLayer(startPageId, startRowIndex, layer, localMap, layerKeyFn)) return;
```

**5E — `planCascade` (line 518 এর while loop):** carry propagate করার সময় area row skip:
```typescript
while (carry !== "" && pi < allPages.length) {
  const page = allPages[pi];
  if (!page) break;
  if (ri >= page.lines.length) { pi += 1; ri = 0; continue; }

  // Area-mode row: jump over it without consuming carry.
  if (isAreaLayer(page.id, ri, layer, localMap, layerKeyFn)) {
    ri += 1;
    continue;
  }

  // ... existing existing/combined/splitToFit logic unchanged ...
}
```

### সিদ্ধান্ত

- Start row যদি area-mode-এ থাকে: `reflowFrom`/`reflowFromAsync`-এর caller (FabricLines `checkOverflow`) STEP 3-এ ইতিমধ্যেই early-return করে — তাই start row area-mode-এ কখনোই এই function-এ পৌঁছাবে না। তবু `reflowFrom`/`reflowFromAsync`-এ start row-এর জন্য guard skip করা **হবে না** (caller-এর responsibility); শুধু subsequent rows skip হবে।
- Tail overflow: যদি cascade-এর শেষে carry-text রয়ে যায় (সব subsequent rows area বা scope শেষ), সেটা `tailOverflow`-এ যাবে (existing behavior)। caller dialog-এ এটা দেখাবে।
- কোনো নতুন store/event/migration নেই — শুধু read-only check।

### যা পরিবর্তন হবে না
- `splitToFit` / `splitToFitForLayer` / `getEffectiveText`
- `collapseLineBreakBackward` — এটা Backspace-merge logic; area mode-এ Backspace-collapse already STEP 3-এ block করা।
- `reflowLayerText` — internally `reflowFromAsync` কল করে, তাই auto-inherit।
- কোনো UI/state/component।

### Verification
- Build পাস হবে।
- Default behavior (সব row point mode): কোনো change নেই — `isAreaLayer` সবসময় false।
- DevTools-এ row N-এ `textMode: "area"` সেট করে row N-1-এ overflow তৈরি করলে — cascade row N skip করে row N+1-এ যাবে; row N-এর text অটুট থাকবে।
- BackFill: area row-এর পরের row থেকে word pull-back করার সময় area row skip হবে।

### STEP 6 প্রিভিউ
`calculateAreaTextHeight(text, fontFamily, fontSize, width, leading)` helper যোগ করা — DOM measure / canvas-based wrap simulation। STEP 7-এর Auto-fit button এটা ব্যবহার করবে।
