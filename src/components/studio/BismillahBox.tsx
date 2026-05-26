import { memo } from "react";

type Props = {
  arabic: string;
  bangla: string;
};

export const BismillahBox = memo(function BismillahBox({ arabic, bangla }: Props) {
  return (
    <div className="mx-auto mt-3 w-[88%] border-2 border-red-600 bg-amber-50/60 px-4 py-2 text-center">
      <div
        className="text-3xl text-neutral-900"
        style={{ fontFamily: "var(--font-arabic)" }}
        dir="rtl"
        lang="ar"
      >
        {arabic}
      </div>
      <div className="mt-1 text-xs text-emerald-800" lang="bn">
        {bangla}
      </div>
    </div>
  );
});
