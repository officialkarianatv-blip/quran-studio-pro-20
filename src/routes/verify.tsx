import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import versesData from "@/data/verses.json";
import { VerseRow, type Verse } from "@/components/verify/VerseRow";
import { BookOpen, ChevronLeft, Search } from "lucide-react";

// ── সব ১১৪ সূরার নাম (বাংলা অনুবাদ সহ) ─────────────────────────────
// প্রতিটি entry: [সূরা নং, বাংলা নাম, আয়াত সংখ্যা]
const SURAH_LIST: [number, string, number][] = [
  [1, "আল-ফাতিহা", 7],
  [2, "আল-বাকারা", 286],
  [3, "আলে ইমরান", 200],
  [4, "আন-নিসা", 176],
  [5, "আল-মায়িদাহ", 120],
  [6, "আল-আনআম", 165],
  [7, "আল-আরাফ", 206],
  [8, "আল-আনফাল", 75],
  [9, "আত-তাওবা", 129],
  [10, "ইউনুস", 109],
  [11, "হূদ", 123],
  [12, "ইউসুফ", 111],
  [13, "আর-রাদ", 43],
  [14, "ইব্রাহিম", 52],
  [15, "আল-হিজর", 99],
  [16, "আন-নাহল", 128],
  [17, "আল-ইসরা", 111],
  [18, "আল-কাহফ", 110],
  [19, "মারইয়াম", 98],
  [20, "ত্বা-হা", 135],
  [21, "আল-আম্বিয়া", 112],
  [22, "আল-হাজ্জ", 78],
  [23, "আল-মুমিনুন", 118],
  [24, "আন-নূর", 64],
  [25, "আল-ফুরকান", 77],
  [26, "আশ-শুআরা", 227],
  [27, "আন-নামল", 93],
  [28, "আল-কাসাস", 88],
  [29, "আল-আনকাবুত", 69],
  [30, "আর-রূম", 60],
  [31, "লুকমান", 34],
  [32, "আস-সাজদা", 30],
  [33, "আল-আহযাব", 73],
  [34, "সাবা", 54],
  [35, "ফাতির", 45],
  [36, "ইয়া-সিন", 83],
  [37, "আস-সাফফাত", 182],
  [38, "সোয়াদ", 88],
  [39, "আয-যুমার", 75],
  [40, "গাফির", 85],
  [41, "ফুস্সিলাত", 54],
  [42, "আশ-শুরা", 53],
  [43, "আয-যুখরুফ", 89],
  [44, "আদ-দুখান", 59],
  [45, "আল-জাসিয়া", 37],
  [46, "আল-আহকাফ", 35],
  [47, "মুহাম্মদ", 38],
  [48, "আল-ফাতহ", 29],
  [49, "আল-হুজুরাত", 18],
  [50, "কাফ", 45],
  [51, "আয-যারিয়াত", 60],
  [52, "আত-তূর", 49],
  [53, "আন-নাজম", 62],
  [54, "আল-কামার", 55],
  [55, "আর-রাহমান", 78],
  [56, "আল-ওয়াকিআ", 96],
  [57, "আল-হাদিদ", 29],
  [58, "আল-মুজাদিলা", 22],
  [59, "আল-হাশর", 24],
  [60, "আল-মুমতাহিনা", 13],
  [61, "আস-সাফ", 14],
  [62, "আল-জুমুআ", 11],
  [63, "আল-মুনাফিকুন", 11],
  [64, "আত-তাগাবুন", 18],
  [65, "আত-তালাক", 12],
  [66, "আত-তাহরিম", 12],
  [67, "আল-মুলক", 30],
  [68, "আল-কালাম", 52],
  [69, "আল-হাক্কা", 52],
  [70, "আল-মাআরিজ", 44],
  [71, "নূহ", 28],
  [72, "আল-জিন", 28],
  [73, "আল-মুযযাম্মিল", 20],
  [74, "আল-মুদ্দাস্সির", 56],
  [75, "আল-কিয়ামা", 40],
  [76, "আল-ইনসান", 31],
  [77, "আল-মুরসালাত", 50],
  [78, "আন-নাবা", 40],
  [79, "আন-নাযিআত", 46],
  [80, "আবাসা", 42],
  [81, "আত-তাকভির", 29],
  [82, "আল-ইনফিতার", 19],
  [83, "আল-মুতাফফিফিন", 36],
  [84, "আল-ইনশিকাক", 25],
  [85, "আল-বুরূজ", 22],
  [86, "আত-তারিক", 17],
  [87, "আল-আলা", 19],
  [88, "আল-গাশিয়া", 26],
  [89, "আল-ফাজর", 30],
  [90, "আল-বালাদ", 20],
  [91, "আশ-শামস", 15],
  [92, "আল-লাইল", 21],
  [93, "আদ-দুহা", 11],
  [94, "আশ-শারহ", 8],
  [95, "আত-তিন", 8],
  [96, "আল-আলাক", 19],
  [97, "আল-কাদর", 5],
  [98, "আল-বাইয়্যিনা", 8],
  [99, "আয-যিলযাল", 8],
  [100, "আল-আদিয়াত", 11],
  [101, "আল-কারিআ", 11],
  [102, "আত-তাকাসুর", 8],
  [103, "আল-আসর", 3],
  [104, "আল-হুমাযা", 9],
  [105, "আল-ফিল", 5],
  [106, "কুরাইশ", 4],
  [107, "আল-মাউন", 7],
  [108, "আল-কাউসার", 3],
  [109, "আল-কাফিরুন", 6],
  [110, "আন-নাসর", 3],
  [111, "আল-মাসাদ", 5],
  [112, "আল-ইখলাস", 4],
  [113, "আল-ফালাক", 5],
  [114, "আন-নাস", 6],
];

// URL search params validation — TanStack Router pattern
// validateSearch: URL ?surah=2&from=1&to=7 → typed object
export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    surah: Math.min(114, Math.max(1, Number(search.surah ?? 2))),
    from: Math.max(1, Number(search.from ?? 1)),
    to: Math.max(1, Number(search.to ?? 7)),
  }),
  head: ({ match }) => {
    const s = match.search.surah;
    const name = SURAH_LIST.find(([n]) => n === s)?.[1] ?? `সূরা ${s}`;
    return {
      meta: [{ title: `তাজবীদ ভেরিফাই — ${name} (${match.search.from}–${match.search.to})` }],
    };
  },
  component: VerifyPage,
});

function VerifyPage() {
  // Route.useSearch() → returns typed { surah, from, to } from URL
  const { surah, from, to } = Route.useSearch();
  const navigate = useNavigate({ from: "/verify" });

  // Local form state (before user clicks "দেখুন")
  const [formSurah, setFormSurah] = useState(surah);
  const [formFrom, setFormFrom] = useState(from);
  const [formTo, setFormTo] = useState(to);

  // Selected surah info from our list
  const surahInfo = SURAH_LIST.find(([n]) => n === surah) ?? [surah, `সূরা ${surah}`, 286];
  const [, surahName, maxAyah] = surahInfo;

  // When surah dropdown changes, update from/to limits automatically
  const handleSurahChange = (newSurah: number) => {
    const info = SURAH_LIST.find(([n]) => n === newSurah);
    const max = info?.[2] ?? 286;
    setFormSurah(newSurah);
    setFormFrom(1);
    setFormTo(Math.min(10, max)); // default: first 10 ayahs (or fewer if short surah)
  };

  // Navigate → updates URL → triggers re-render with new search params
  const handleSearch = () => {
    const clampedFrom = Math.max(1, formFrom);
    const clampedTo = Math.min(
      SURAH_LIST.find(([n]) => n === formSurah)?.[2] ?? 286,
      Math.max(clampedFrom, formTo),
    );
    navigate({
      search: { surah: formSurah, from: clampedFrom, to: clampedTo },
    });
  };

  // Filter verses from the full dataset based on URL params
  // versesData: all Quran verses array
  // v.s = surah number, v.v = ayah number
  const verses = useMemo(
    () =>
      (versesData as Verse[]).filter(
        (v) => v.s === surah && v.v >= from && v.v <= to,
      ),
    [surah, from, to],
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* ── Top navigation bar ────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          {/* Back to studio */}
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700
                       bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300
                       transition-colors hover:bg-neutral-700 hover:text-neutral-100"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            স্টুডিওতে ফিরুন
          </a>

          <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
            <BookOpen className="h-4 w-4" />
            তাজবীদ ভেরিফাই
          </div>
        </div>
      </div>

      {/* ── Search / filter panel ─────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-amber-400">
            সূরা ও আয়াত নির্বাচন করুন
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            {/* Surah dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                সূরা
              </label>
              <select
                value={formSurah}
                onChange={(e) => handleSurahChange(Number(e.target.value))}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2
                           text-sm text-neutral-100 outline-none focus:border-amber-500
                           transition-colors"
              >
                {SURAH_LIST.map(([num, name, ayahCount]) => (
                  <option key={num} value={num}>
                    {num}. {name} ({ayahCount} আয়াত)
                  </option>
                ))}
              </select>
            </div>

            {/* From ayah */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                শুরু আয়াত
              </label>
              <input
                type="number"
                min={1}
                max={SURAH_LIST.find(([n]) => n === formSurah)?.[2] ?? 286}
                value={formFrom}
                onChange={(e) => setFormFrom(Math.max(1, Number(e.target.value)))}
                className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2
                           text-sm text-neutral-100 outline-none focus:border-amber-500
                           transition-colors"
              />
            </div>

            {/* To ayah */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                শেষ আয়াত
              </label>
              <input
                type="number"
                min={formFrom}
                max={SURAH_LIST.find(([n]) => n === formSurah)?.[2] ?? 286}
                value={formTo}
                onChange={(e) => setFormTo(Number(e.target.value))}
                className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2
                           text-sm text-neutral-100 outline-none focus:border-amber-500
                           transition-colors"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2
                         text-sm font-bold text-neutral-950 transition-colors
                         hover:bg-amber-400 active:scale-95"
            >
              <Search className="h-4 w-4" />
              দেখুন
            </button>

            {/* Quick-links */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {[
                { label: "ফাতিহা", s: 1, f: 1, t: 7 },
                { label: "বাকারা ১–১৮", s: 2, f: 1, t: 18 },
                { label: "আল-ফাতহ ১–১০", s: 48, f: 1, t: 10 },
                { label: "ইখলাস", s: 112, f: 1, t: 4 },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() =>
                    navigate({ search: { surah: q.s, from: q.f, to: q.t } })
                  }
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium
                             transition-colors ${
                               surah === q.s && from === q.f && to === q.t
                                 ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                                 : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                             }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results header ────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-100">
              {surahName}
              <span className="ml-2 text-base font-normal text-neutral-400">
                আয়াত {from}–{to}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              {verses.length} টি আয়াত • বাম: তাজবীদ প্রতীক সহ আরবি • ডান: শব্দ-বিশ্লেষণ
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-center">
            <div className="text-lg font-bold text-amber-300">{verses.length}</div>
            <div className="text-[9px] text-neutral-500">আয়াত</div>
          </div>
        </div>
      </div>

      {/* ── Verse rows ────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16">
        {verses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl
                          border border-dashed border-neutral-800 py-16 text-center">
            <BookOpen className="mb-3 h-8 w-8 text-neutral-700" />
            <p className="text-sm text-neutral-500">
              এই সূরায় নির্বাচিত আয়াত সীমায় কোনো ডেটা পাওয়া যায়নি।
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              সূরা নম্বর {surah} • আয়াত {from}–{to}
            </p>
          </div>
        ) : (
          verses.map((verse) => <VerseRow key={verse.id} verse={verse} />)
        )}
      </div>
    </div>
  );
}
