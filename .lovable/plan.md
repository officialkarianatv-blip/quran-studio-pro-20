## অডিট ফলাফল

পূর্ব রাউন্ডে A ও E fix হয়েছে। বাকি ৫ টা ঝুঁকি যাচাই:

| Id | ঝুঁকি | বর্তমান অবস্থা | অ্যাকশন |
|----|------|----------------|---------|
| **B** | `reflowLayerText` scope absent হলে `editorStore` থেকে পড়ে — race ঝুঁকি | typography path সবসময় `scope: eff` পাঠাচ্ছে; FabricLines getReflowBase একই tick-এ scope পড়ছে — race কম | **লো-প্রাইওরিটি**, fallback রাখব কিন্তু caller-এ explicit pass বাধ্যতামূলক করব |
| **C** | সাধারণ টাইপিং-এ overflow পেজ/সূরা ক্রস করলে dialog নেই | `checkOverflow` সরাসরি `reflowFromAsync` চালায়, planCascade dry-run করে না | **ফিক্স দরকার** ✅ |
| **D** | সাধারণ টাইপিং-এ surah-cross সতর্কতা নেই | একই | **ফিক্স দরকার** ✅ (user confirmed) |
| **F** | Bangla splitter ভুল splitter ব্যবহার করছে কিনা | `splitToFitForLayer` → Bangla path `splitToFitCanvas` (whitespace) — সঠিক | ✅ OK |
| **G** | Link OFF অবস্থায় typography fan-out আটকাচ্ছে কিনা | `effectiveScope` linking OFF হলে scope → "general", fan-out হয় না | ✅ OK |

---

## পরিকল্পনা (Fix C/D + B)

### Fix C/D — সাধারণ টাইপিং-এ page/surah-cross dialog

`src/components/studio/FabricLines.tsx`-এর `checkOverflow` ফাংশনে (lines ~753–841):

1. Overflow পেলে cascade শুরু করার আগে `planCascade` চালাব (dry-run, কোনো store mutation নেই) — শুরু row = `targetPageId, targetRowIdx` (যেমন Enter path-এ আছে)।
2. `plan.crossesPage || plan.crossesSurah` হলে:
   - বর্তমান row-এ `fits` apply করব (যাতে user টাইপিং harm না হয়)।
   - `editorStore.setPendingReflow({...confirm: runReflow, cancel: revertFitsToOriginal})` কল করব।
   - `CrossPageReflowDialog` ইতিমধ্যে এই signal handle করে।
3. একই পেজের মধ্যে cascade হলে আগের মতোই directly `reflowFromAsync`।
4. দ্রুত typing-এ একই overflow-এ বারবার dialog পপ-আপ এড়াতে: একটি `pendingReflow` ইতিমধ্যে সেট থাকলে নতুন cascade trigger করব না।

### Fix B — Scope race tightening

`src/lib/textReflow.ts` → `reflowLayerText`: `scope` undefined হলে warn log করব এবং `editorStore` fallback রাখব (backward compat)। Typography ও inline-edit caller-এর scope explicit pass করার জন্য আজ পরিবর্তন দরকার নেই (ইতিমধ্যে করছে)।

---

## প্রভাবিত ফাইল

- `src/components/studio/FabricLines.tsx` — `checkOverflow`-এ planCascade gate যোগ
- `src/lib/textReflow.ts` — minor scope-fallback warning

ব্যাকএন্ড/স্কিমা/Telegram কিছু পাল্টাবে না।

---

## টেস্ট (preview-এ)

1. Surah-এর শেষ row-এ অতিরিক্ত word টাইপ করুন (scope=surah) → dialog আসবে।
2. পেজের শেষ row-তে শুধু page-scope-এ word টাইপ করুন → row-এ clip হবে (cross-page হয় না)।
3. Link OFF অবস্থায় টাইপিং → কোনো dialog নয়, current row-এ clip + toast।
