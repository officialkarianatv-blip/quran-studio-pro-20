import { memo } from "react";

type Props = {
  surahName: string;
  revelation: string;
  ayah: string;
  ruku: string;
};

export const ArchedHeader = memo(function ArchedHeader({ surahName, revelation, ayah, ruku }: Props) {
  return (
    <div className="relative">
      {/* ornament strip */}
      <div className="h-24 rounded-t-[40%_60%] bg-gradient-to-b from-emerald-200 via-emerald-100 to-amber-50 border-b border-emerald-700/40 flex items-end justify-center">
        <div
          aria-hidden
          className="absolute inset-x-2 top-1 h-16 rounded-t-[40%_60%] opacity-90"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#16a34a22 0 6px,#f59e0b22 6px 12px,#dc262622 12px 18px,#2563eb22 18px 24px)",
          }}
        />
      </div>
      <div className="relative -mt-6 mx-auto w-[78%] rounded-b-[50%_30%] border-2 border-emerald-700/70 bg-amber-50 px-6 pb-3 pt-4 text-center shadow-sm">
        <div
          className="text-2xl font-bold text-neutral-900"
          style={{ fontFamily: "'Noto Serif Bengali', serif" }}
        >
          {surahName}
        </div>
        <div className="mt-1 text-sm font-semibold text-red-600">{revelation}</div>
        <div className="text-xs text-neutral-700">
          আয়াত-{ayah}, রুকু-{ruku}
        </div>
      </div>
    </div>
  );
});
