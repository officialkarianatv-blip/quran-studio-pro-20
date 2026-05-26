import { ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useReflowStore } from "@/state/reflowStore";
import type { PageDistribution } from "@/state/reflowStore";
import { useEditorStore } from "@/state/editorStore";

type Props = {
  pages?: unknown;
  activeId: string;
  onSelect: (id: string) => void;
};

const SURAH_NAMES: Record<number, string> = {
  1: "আল-ফাতিহা",
  2: "আল-বাকারা",
  3: "আলে ইমরান",
  4: "আন-নিসা",
  5: "আল-মায়িদা",
  6: "আল-আনআম",
  7: "আল-আরাফ",
  8: "আল-আনফাল",
  9: "আত-তাওবা",
  10: "ইউনুস",
  11: "হুদ",
  12: "ইউসুফ",
  13: "আর-রাদ",
  14: "ইব্রাহিম",
  15: "আল-হিজর",
  16: "আন-নাহল",
  17: "আল-ইসরা",
  18: "আল-কাহফ",
  19: "মারইয়াম",
  20: "ত্ব-হা",
  21: "আল-আম্বিয়া",
  22: "আল-হাজ্জ",
  23: "আল-মুমিনুন",
  24: "আন-নূর",
  25: "আল-ফুরকান",
  26: "আশ-শুআরা",
  27: "আন-নামল",
  28: "আল-কাসাস",
  29: "আল-আনকাবুত",
  30: "আর-রূম",
  31: "লুকমান",
  32: "আস-সাজদা",
  33: "আল-আহযাব",
  34: "সাবা",
  35: "ফাতির",
  36: "ইয়াসিন",
  37: "আস-সাফফাত",
  38: "সাদ",
  39: "আজ-জুমার",
  40: "গাফির",
  41: "ফুসসিলাত",
  42: "আশ-শুরা",
  43: "আজ-জুখরুফ",
  44: "আদ-দুখান",
  45: "আল-জাসিয়া",
  46: "আল-আহকাফ",
  47: "মুহাম্মাদ",
  48: "আল-ফাতহ",
  49: "আল-হুজুরাত",
  50: "কাফ",
  51: "আজ-জারিয়াত",
  52: "আত-তূর",
  53: "আন-নাজম",
  54: "আল-কামার",
  55: "আর-রাহমান",
  56: "আল-ওয়াকিয়া",
  57: "আল-হাদিদ",
  58: "আল-মুজাদিলা",
  59: "আল-হাশর",
  60: "আল-মুমতাহিনা",
  61: "আস-সাফ",
  62: "আল-জুমুআ",
  63: "আল-মুনাফিকুন",
  64: "আত-তাগাবুন",
  65: "আত-তালাক",
  66: "আত-তাহরিম",
  67: "আল-মুলক",
  68: "আল-কলম",
  69: "আল-হাক্কা",
  70: "আল-মাআরিজ",
  71: "নূহ",
  72: "আল-জিন",
  73: "আল-মুজ্জাম্মিল",
  74: "আল-মুদ্দাসসির",
  75: "আল-কিয়ামা",
  76: "আল-ইনসান",
  77: "আল-মুরসালাত",
  78: "আন-নাবা",
  79: "আন-নাজিয়াত",
  80: "আবাসা",
  81: "আত-তাকভীর",
  82: "আল-ইনফিতার",
  83: "আল-মুতাফফিফিন",
  84: "আল-ইনশিকাক",
  85: "আল-বুরূজ",
  86: "আত-তারিক",
  87: "আল-আলা",
  88: "আল-গাশিয়া",
  89: "আল-ফাজর",
  90: "আল-বালাদ",
  91: "আশ-শামস",
  92: "আল-লাইল",
  93: "আদ-দুহা",
  94: "আশ-শারহ",
  95: "আত-তিন",
  96: "আল-আলাক",
  97: "আল-কদর",
  98: "আল-বাইয়্যিনা",
  99: "আজ-জালজালা",
  100: "আল-আদিয়াত",
  101: "আল-কারিয়া",
  102: "আত-তাকাসুর",
  103: "আল-আসর",
  104: "আল-হুমাযা",
  105: "আল-ফিল",
  106: "কুরাইশ",
  107: "আল-মাউন",
  108: "আল-কাওসার",
  109: "আল-কাফিরুন",
  110: "আন-নাসর",
  111: "আল-মাসাদ",
  112: "আল-ইখলাস",
  113: "আল-ফালাক",
  114: "আন-নাস",
};

const SURAH_NAMES_AR: Record<number, string> = {
  1: "الفاتحة",
  2: "البقرة",
  3: "آل عمران",
  4: "النساء",
  5: "المائدة",
  6: "الأنعام",
  7: "الأعراف",
  8: "الأنفال",
  9: "التوبة",
  10: "يونس",
  11: "هود",
  12: "يوسف",
  13: "الرعد",
  14: "إبراهيم",
  15: "الحجر",
  16: "النحل",
  17: "الإسراء",
  18: "الكهف",
  19: "مريم",
  20: "طه",
  21: "الأنبياء",
  22: "الحج",
  23: "المؤمنون",
  24: "النور",
  25: "الفرقان",
  26: "الشعراء",
  27: "النمل",
  28: "القصص",
  29: "العنكبوت",
  30: "الروم",
  31: "لقمان",
  32: "السجدة",
  33: "الأحزاب",
  34: "سبإ",
  35: "فاطر",
  36: "يس",
  37: "الصافات",
  38: "ص",
  39: "الزمر",
  40: "غافر",
  41: "فصلت",
  42: "الشورى",
  43: "الزخرف",
  44: "الدخان",
  45: "الجاثية",
  46: "الأحقاف",
  47: "محمد",
  48: "الفتح",
  49: "الحجرات",
  50: "ق",
  51: "الذاريات",
  52: "الطور",
  53: "النجم",
  54: "القمر",
  55: "الرحمن",
  56: "الواقعة",
  57: "الحديد",
  58: "المجادلة",
  59: "الحشر",
  60: "الممتحنة",
  61: "الصف",
  62: "الجمعة",
  63: "المنافقون",
  64: "التغابن",
  65: "الطلاق",
  66: "التحريم",
  67: "الملك",
  68: "القلم",
  69: "الحاقة",
  70: "المعارج",
  71: "نوح",
  72: "الجن",
  73: "المزمل",
  74: "المدثر",
  75: "القيامة",
  76: "الإنسان",
  77: "المرسلات",
  78: "النبأ",
  79: "النازعات",
  80: "عبس",
  81: "التكوير",
  82: "الانفطار",
  83: "المطففين",
  84: "الانشقاق",
  85: "البروج",
  86: "الطارق",
  87: "الأعلى",
  88: "الغاشية",
  89: "الفجر",
  90: "البلد",
  91: "الشمس",
  92: "الليل",
  93: "الضحى",
  94: "الشرح",
  95: "التين",
  96: "العلق",
  97: "القدر",
  98: "البينة",
  99: "الزلزلة",
  100: "العاديات",
  101: "القارعة",
  102: "التكاثر",
  103: "العصر",
  104: "الهمزة",
  105: "الفيل",
  106: "قريش",
  107: "الماعون",
  108: "الكوثر",
  109: "الكافرون",
  110: "النصر",
  111: "المسد",
  112: "الإخلاص",
  113: "الفلق",
  114: "الناس",
};

const SURAH_NAMES_EN: Record<number, string> = {
  1: "Al-Fatihah",
  2: "Al-Baqarah",
  3: "Ali Imran",
  4: "An-Nisa",
  5: "Al-Ma'idah",
  6: "Al-An'am",
  7: "Al-A'raf",
  8: "Al-Anfal",
  9: "At-Tawbah",
  10: "Yunus",
  11: "Hud",
  12: "Yusuf",
  13: "Ar-Ra'd",
  14: "Ibrahim",
  15: "Al-Hijr",
  16: "An-Nahl",
  17: "Al-Isra",
  18: "Al-Kahf",
  19: "Maryam",
  20: "Ta-Ha",
  21: "Al-Anbya",
  22: "Al-Hajj",
  23: "Al-Mu'minun",
  24: "An-Nur",
  25: "Al-Furqan",
  26: "Ash-Shu'ara",
  27: "An-Naml",
  28: "Al-Qasas",
  29: "Al-'Ankabut",
  30: "Ar-Rum",
  31: "Luqman",
  32: "As-Sajdah",
  33: "Al-Ahzab",
  34: "Saba",
  35: "Fatir",
  36: "Ya-Sin",
  37: "As-Saffat",
  38: "Sad",
  39: "Az-Zumar",
  40: "Ghafir",
  41: "Fussilat",
  42: "Ash-Shura",
  43: "Az-Zukhruf",
  44: "Ad-Dukhan",
  45: "Al-Jathiyah",
  46: "Al-Ahqaf",
  47: "Muhammad",
  48: "Al-Fath",
  49: "Al-Hujurat",
  50: "Qaf",
  51: "Adh-Dhariyat",
  52: "At-Tur",
  53: "An-Najm",
  54: "Al-Qamar",
  55: "Ar-Rahman",
  56: "Al-Waqi'ah",
  57: "Al-Hadid",
  58: "Al-Mujadilah",
  59: "Al-Hashr",
  60: "Al-Mumtahanah",
  61: "As-Saff",
  62: "Al-Jumu'ah",
  63: "Al-Munafiqun",
  64: "At-Taghabun",
  65: "At-Talaq",
  66: "At-Tahrim",
  67: "Al-Mulk",
  68: "Al-Qalam",
  69: "Al-Haqqah",
  70: "Al-Ma'arij",
  71: "Nuh",
  72: "Al-Jinn",
  73: "Al-Muzzammil",
  74: "Al-Muddaththir",
  75: "Al-Qiyamah",
  76: "Al-Insan",
  77: "Al-Mursalat",
  78: "An-Naba",
  79: "An-Nazi'at",
  80: "'Abasa",
  81: "At-Takwir",
  82: "Al-Infitar",
  83: "Al-Mutaffifin",
  84: "Al-Inshiqaq",
  85: "Al-Buruj",
  86: "At-Tariq",
  87: "Al-A'la",
  88: "Al-Ghashiyah",
  89: "Al-Fajr",
  90: "Al-Balad",
  91: "Ash-Shams",
  92: "Al-Layl",
  93: "Ad-Duha",
  94: "Ash-Sharh",
  95: "At-Tin",
  96: "Al-'Alaq",
  97: "Al-Qadr",
  98: "Al-Bayyinah",
  99: "Az-Zalzalah",
  100: "Al-'Adiyat",
  101: "Al-Qari'ah",
  102: "At-Takathur",
  103: "Al-'Asr",
  104: "Al-Humazah",
  105: "Al-Fil",
  106: "Quraysh",
  107: "Al-Ma'un",
  108: "Al-Kawthar",
  109: "Al-Kafirun",
  110: "An-Nasr",
  111: "Al-Masad",
  112: "Al-Ikhlas",
  113: "Al-Falaq",
  114: "An-Nas",
};

const SURAH_AYAH_COUNT: Record<number, number> = {
  1: 7,
  2: 286,
  3: 200,
  4: 176,
  5: 120,
  6: 165,
  7: 206,
  8: 75,
  9: 129,
  10: 109,
  11: 123,
  12: 111,
  13: 43,
  14: 52,
  15: 99,
  16: 128,
  17: 111,
  18: 110,
  19: 98,
  20: 135,
  21: 112,
  22: 78,
  23: 118,
  24: 64,
  25: 77,
  26: 227,
  27: 93,
  28: 88,
  29: 69,
  30: 60,
  31: 34,
  32: 30,
  33: 73,
  34: 54,
  35: 45,
  36: 83,
  37: 182,
  38: 88,
  39: 75,
  40: 85,
  41: 54,
  42: 53,
  43: 89,
  44: 59,
  45: 37,
  46: 35,
  47: 38,
  48: 29,
  49: 18,
  50: 45,
  51: 60,
  52: 49,
  53: 62,
  54: 55,
  55: 78,
  56: 96,
  57: 29,
  58: 22,
  59: 24,
  60: 13,
  61: 14,
  62: 11,
  63: 11,
  64: 18,
  65: 12,
  66: 12,
  67: 30,
  68: 52,
  69: 52,
  70: 44,
  71: 28,
  72: 28,
  73: 20,
  74: 56,
  75: 40,
  76: 31,
  77: 50,
  78: 40,
  79: 46,
  80: 42,
  81: 29,
  82: 19,
  83: 36,
  84: 25,
  85: 22,
  86: 17,
  87: 19,
  88: 26,
  89: 30,
  90: 20,
  91: 15,
  92: 21,
  93: 11,
  94: 8,
  95: 8,
  96: 19,
  97: 5,
  98: 8,
  99: 8,
  100: 11,
  101: 11,
  102: 8,
  103: 3,
  104: 9,
  105: 5,
  106: 4,
  107: 7,
  108: 3,
  109: 6,
  110: 3,
  111: 5,
  112: 4,
  113: 5,
  114: 6,
};

function bnNum(n: number | string): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/[-_./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function surahNameBn(n: number): string {
  return SURAH_NAMES[n] ?? `সূরা ${bnNum(n)}`;
}

function surahNameAr(n: number): string {
  return SURAH_NAMES_AR[n] ?? `سورة ${n}`;
}

function surahNameEn(n: number): string {
  return SURAH_NAMES_EN[n] ?? `Surah ${n}`;
}

function surahAyahCount(n: number): number {
  return SURAH_AYAH_COUNT[n] ?? 0;
}

function ayahLabelBn(n: number): string {
  return `${bnNum(n)} আয়াত`;
}

export function PageList({ activeId, onSelect }: Props) {
  const [q, setQ] = useState("");
  const distribution = useReflowStore((s) => s.distribution);
  const expandedSurahs = useEditorStore((s) => s.expandedSurahs);
  const toggleSurah = useEditorStore((s) => s.toggleSurah);
  const expandSurah = useEditorStore((s) => s.expandSurah);

  const grouped = useMemo(() => {
    const map = new Map<number, PageDistribution[]>();
    for (const d of distribution) {
      const arr = map.get(d.surah);
      if (arr) arr.push(d);
      else map.set(d.surah, [d]);
    }
    return Array.from(map.entries());
  }, [distribution]);

  const filteredGroups = useMemo(() => {
    const needle = normalizeSearch(q);
    if (!needle) return grouped;

    return grouped.filter(([s]) => {
      const searchTargets = [
        String(s),
        surahNameBn(s),
        surahNameAr(s),
        surahNameEn(s),
        ayahLabelBn(surahAyahCount(s)),
      ].map(normalizeSearch);
      return searchTargets.some((target) => target.includes(needle));
    });
  }, [grouped, q]);

  const activeIdx = distribution.findIndex((d) => d.pageId === activeId);
  const activeData = distribution[activeIdx];
  const hasSearch = q.trim().length > 0;

  useEffect(() => {
    if (activeData) expandSurah(activeData.surah);
  }, [activeData?.surah, expandSurah, activeData]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-800/80 bg-neutral-950 text-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-neutral-800">
            <FileText className="h-3.5 w-3.5 text-amber-400" />
          </div>
          পেজ তালিকা
        </div>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
          {distribution.length}
        </span>
      </div>

      {activeData && (
        <div className="border-b border-neutral-800 bg-neutral-900/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">বর্তমান পেজ</span>
            <span className="text-[10px] font-bold text-amber-400">
              {activeIdx + 1} / {distribution.length}
            </span>
          </div>
          <div className="mt-1 text-xs font-medium text-neutral-200 truncate">
            {surahNameBn(activeData.surah)}
            {activeData.firstVerse != null && (
              <span className="ml-1 text-neutral-500">
                {bnNum(activeData.firstVerse)}–{bnNum(activeData.lastVerse ?? activeData.firstVerse)}
              </span>
            )}
          </div>
          <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
              style={{ width: `${((activeIdx + 1) / distribution.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="border-b border-neutral-800 px-2.5 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="সূরা খুঁজুন (Arabic/Bengali/English)…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-3 text-xs text-neutral-100 placeholder-neutral-600 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredGroups.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-neutral-600">
            কোনো সূরা পাওয়া যায়নি
          </div>
        ) : (
          filteredGroups.map(([surah, pages]) => {
            const isExpanded = hasSearch || expandedSurahs.has(surah);
            const containsActive = pages.some((p) => p.pageId === activeId);
            const totalAyah = surahAyahCount(surah);
            const headerClick = () => {
              toggleSurah(surah);
              const firstPageId = pages[0]?.pageId;
              if (firstPageId) onSelect(firstPageId);
            };

            return (
              <div key={surah} className="border-b border-neutral-900/80">
                <button
                  onClick={headerClick}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    containsActive
                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                      : "hover:bg-neutral-900/60"
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  )}
                  <span
                    className={`flex h-5 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                      containsActive
                        ? "bg-amber-500 text-neutral-950"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {bnNum(surah)}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span
                        dir="rtl"
                        className="truncate text-sm font-semibold text-neutral-100"
                        style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                      >
                        {surahNameAr(surah)}
                      </span>
                      <span className="truncate text-[10px] text-neutral-500">
                        {surahNameBn(surah)} · {surahNameEn(surah)}
                      </span>
                      <span className="truncate text-[9px] text-neutral-600">
                        {ayahLabelBn(totalAyah)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500">
                        {ayahLabelBn(totalAyah)}
                      </span>
                      <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-400">
                        {bnNum(pages.length)}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-neutral-950/60 pb-1">
                    {pages.map((d) => {
                      const active = d.pageId === activeId;
                      const ayahRangeLabel =
                        d.firstVerse != null && d.lastVerse != null
                          ? `আয়াত ${bnNum(d.firstVerse)}–${bnNum(d.lastVerse)}`
                          : `পেজ ${bnNum(d.pageNo)}`;
                      return (
                        <button
                          key={d.pageId}
                          onClick={() => onSelect(d.pageId)}
                          className={`group flex w-full items-center gap-2.5 border-l-2 px-3 py-1.5 pl-9 text-left text-xs transition-all ${
                            active
                              ? "border-amber-400 bg-gradient-to-r from-amber-500/10 to-transparent text-amber-100"
                              : "border-transparent text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900/60 hover:text-neutral-200"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-8 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                              active
                                ? "bg-amber-500/90 text-neutral-950"
                                : "bg-neutral-800/70 text-neutral-500"
                            }`}
                          >
                            {bnNum(d.pageNo)}
                          </span>
                          <span className="truncate text-[11px]">{ayahRangeLabel}</span>
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
