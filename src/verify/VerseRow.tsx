import { useMemo } from "react";
import { detectTajweed } from "@/lib/tajweed/rules";
import { TAJWEED_CHAR, TAJWEED_RULE_NAMES } from "@/lib/tajweed/svgMap";

export type Verse = { id: number; s: number; v: number; ar: string };

const TASHKEEL_RE = /[\u064B-\u0652\u0670\u0651\u0671\u0640]/;

function splitWords(text: string) {
  const out: { start: number; end: number; word: string }[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    const s = i;
    while (i < text.length && !/\s/.test(text[i])) i++;
    if (s < i) out.push({ start: s, end: i, word: text.slice(s, i) });
  }
  return out;
}

export function VerseRow({ verse }: { verse: Verse }) {
  const matches = useMemo(() => detectTajweed(verse.ar), [verse.ar]);
  const matchByIdx = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const m of matches) {
      const arr = map.get(m.charIndex) ?? [];
      arr.push(m.symbol);
      map.set(m.charIndex, arr);
    }
    return map;
  }, [matches]);

  const words = useMemo(() => splitWords(verse.ar), [verse.ar]);

  return (
    <section className="border border-border rounded-lg p-5 bg-card">
      <div className="text-xs text-muted-foreground mb-3">
        {verse.s}:{verse.v}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div
          className="md:col-span-3 leading-[3] text-right"
          dir="rtl"
          style={{
            fontFamily: "'Scheherazade New', 'Amiri', 'Noto Naskh Arabic', serif",
            fontSize: "2.25rem",
          }}
        >
          {Array.from(verse.ar).map((ch, i) => {
            const syms = matchByIdx.get(i);
            if (!syms || syms.length === 0) return <span key={i}>{ch}</span>;
            return (
              <span key={i} style={{ position: "relative", display: "inline-block" }}>
                <span>{ch}</span>
                <span
                  style={{
                    position: "absolute",
                    top: "-1.4em",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: "2px",
                    pointerEvents: "none",
                  }}
                >
                  {syms.map((sym, j) => (
                    <span
                      key={j}
                      className="tajweed-icon"
                      style={{ fontSize: 18, lineHeight: "18px", display: "inline-block" }}
                      aria-label={String(sym)}
                    >
                      {TAJWEED_CHAR[sym as 1]}
                    </span>
                  ))}
                </span>
              </span>
            );
          })}
        </div>

        <div className="md:col-span-2 text-xs font-mono space-y-1">
          {words.map((w, wi) => {
            const hits: { rule: number; letter: string; pos: number }[] = [];
            const baseIdxs: number[] = [];
            for (let k = 0; k < w.word.length; k++) {
              if (!TASHKEEL_RE.test(w.word[k])) baseIdxs.push(k);
            }
            for (const m of matches) {
              if (m.charIndex < w.start || m.charIndex >= w.end) continue;
              const rel = m.charIndex - w.start;
              hits.push({
                rule: m.symbol,
                letter: w.word[rel],
                pos: baseIdxs.indexOf(rel),
              });
            }
            return (
              <div key={wi} className="flex justify-between gap-2 border-b border-border/40 py-1">
                <span dir="rtl" className="text-base">
                  {w.word}
                </span>
                <span className="text-right text-muted-foreground">
                  {hits.length === 0
                    ? "—"
                    : hits
                        .map(
                          (h) =>
                            `${h.rule}@${h.letter}#${h.pos} (${TAJWEED_RULE_NAMES[h.rule as 1]})`,
                        )
                        .join(", ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
