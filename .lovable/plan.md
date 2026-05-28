## STEP 3 — InlineTextEditor — Area Text editing support

### লক্ষ্য
Editing mode-এ `textMode === "area"` হলে contenteditable wrap করবে (cascade নয়), Point mode-এ বর্তমান cascade behavior অপরিবর্তিত থাকবে।

### পরিবর্তন — `src/components/studio/FabricLines.tsx`

**3A — `InlineTextEditor` props-এ `textMode` ও `areaHeight` যোগ করো (line ~657-669):**
```typescript
textMode: "point" | "area";
areaHeight: number | null;
```

**3B — দুই call site-এ props পাস করো:**
- Arabic call (line ~492-506):
  ```typescript
  textMode={aTextMode}
  areaHeight={aAreaHeight}
  ```
- Bangla call (line ~614 এর কাছাকাছি — Bangla `<InlineTextEditor`):
  ```typescript
  textMode={bTextMode}
  areaHeight={bAreaHeight}
  ```

**3C — Editor `<div>` style (line ~1121-1135):** conditional করো:
- `whiteSpace: textMode === "area" ? "normal" : "nowrap"`
- `overflow: "hidden"` (অপরিবর্তিত — Area mode-এ frame-এর বাইরে clip)
- নতুন (area mode-এ only):
  - `wordBreak: textMode === "area" ? "break-word" : undefined`
  - `overflowWrap: textMode === "area" ? "break-word" : undefined`
  - `minHeight: textMode === "area" ? (areaHeight ?? undefined) : "1em"`

**3D — `checkOverflow` (line ~762):** শুরুতে early return যোগ করো —
```typescript
if (textMode === "area") {
  rafRef.current = null;
  syncToStore();
  return;
}
```
এতে Area mode-এ cascade / splitToFit / dialog কোনোটাই trigger হবে না — শুধু text store-এ sync হবে। (STEP 5-এ reflow engine-এও same early-return যাবে।)

**3E — `handleKeyDown` Enter branch (line ~913):** Area mode-এ cascade-based split skip — default contenteditable behavior allow করো অথবা explicit newline insert করো:
```typescript
if (e.key === "Enter" && !e.shiftKey) {
  if (textMode === "area") {
    // Allow native line break inside the frame; prevent <div> wrapping.
    e.preventDefault();
    document.execCommand("insertLineBreak");
    return;
  }
  // ... existing cascade Enter logic unchanged ...
}
```

**3F — `handleKeyDown` Backspace-at-start collapse branch (line ~1084 এর কাছাকাছি, `rowIndex === 0` block):** Area mode-এ collapse skip:
```typescript
if (textMode === "area") {
  // Let default Backspace just edit inside the area; no row collapse.
  return;
}
```
(এটা শুধু তখনই hit হয় যখন backspace cursor row-শুরুতে; safe to skip in area mode।)

### যা পরিবর্তন হবে না
- PropertiesPanel UI toggle (STEP 4)
- `reflowFromAsync` / `planCascade` engine (STEP 5)
- `calculateAreaTextHeight` helper (STEP 6)
- Auto-fit button (STEP 7)
- LocalOverride type (STEP 1-এ done)
- FabricLines display divs (STEP 2-এ done)

### Verification
- TypeScript build পাস হবে (নতুন required props দুই call site-এ provided)।
- Default behavior (Point mode): cascade, dialog, splitToFit সব আগের মতো কাজ করবে।
- DevTools override-এ `textMode: "area"` সেট করে edit শুরু করলে: editor frame-এ text wrap হবে, Enter চাপলে newline পড়বে, cascade dialog আসবে না।
