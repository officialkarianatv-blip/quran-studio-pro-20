import type { WordBlockData } from "@/data/pages";

type Props = {
  data: WordBlockData;
  arabicSize?: string;
};

export function WordBlock({ data, arabicSize = "text-4xl" }: Props) {
  return (
    <div className="relative flex flex-col items-center px-1 pt-3">
      {data.symbol && (
        <span
          className="pointer-events-none absolute -top-0.5 left-1/2 -translate-x-1/2 text-[11px] font-bold text-red-600"
          style={{ fontFamily: "var(--font-arabic)" }}
        >
          {data.symbol}
        </span>
      )}
      <span
        className={`${arabicSize} leading-none text-neutral-900`}
        style={{ fontFamily: "var(--font-arabic)" }}
        lang="ar"
        dir="rtl"
      >
        {data.arabic}
      </span>
    </div>
  );
}
