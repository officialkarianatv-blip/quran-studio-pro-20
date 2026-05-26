import type { GridLineData } from "@/data/pages";
import { WordBlock } from "./WordBlock";

type Props = {
  line: GridLineData;
  arabicSize?: string;
};

export function GridLine({ line, arabicSize }: Props) {
  // Inline-arabic mode (continuous Quran pages — ayah markers embedded in `arabicLine`)
  if (line.arabicLine) {
    return (
      <div className="border-b border-red-400/60 px-3 py-1">
        <div
          dir="rtl"
          lang="ar"
          className={`${arabicSize ?? "text-[28px]"} text-center leading-[1.55] text-neutral-900`}
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          {line.arabicLine}
        </div>
        {line.banglaLine && (
          <div
            dir="ltr"
            lang="bn"
            className="mt-0.5 text-center text-[12px] leading-tight text-emerald-900/90"
            style={{ fontFamily: "var(--font-bangla)" }}
          >
            {line.banglaLine}
          </div>
        )}
      </div>
    );
  }

  // Block-based mode (designed first pages)
  return (
    <div className="border-b border-red-400/70">
      <div
        dir="rtl"
        className="flex justify-between px-2 text-[10px] font-bold text-red-600"
        style={{ fontFamily: "var(--font-arabic)" }}
      >
        {(line.markers ?? []).map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div dir="rtl" className="flex items-end justify-between px-2">
        {line.blocks.map((b, i) => (
          <WordBlock key={i} data={b} arabicSize={arabicSize} />
        ))}
      </div>
      {line.banglaLine && (
        <div
          dir="ltr"
          lang="bn"
          className="px-2 pb-1 pt-0.5 text-center text-[12px] leading-tight text-neutral-800"
        >
          {line.banglaLine}
        </div>
      )}
    </div>
  );
}
