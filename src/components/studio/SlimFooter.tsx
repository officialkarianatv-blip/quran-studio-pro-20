import { memo } from "react";
import type { FooterData } from "@/data/pages";

/** Kariana 5-cell page footer: [surah] [revelation] [pageNo] [ayah • ruku] [manzil]. */
export const SlimFooter = memo(function SlimFooter({ data }: { data: FooterData }) {
  return (
    <div
      className="flex h-full w-full items-stretch bg-white text-[10px] font-semibold text-neutral-900"
      style={{
        fontFamily: "var(--font-bangla)",
        border: "1.5px solid #111",
        boxShadow: "inset 0 0 0 1px #fff, inset 0 0 0 2px #111",
        borderRadius: 2,
      }}
    >
      <div
        className="flex flex-1 items-center justify-center border-r border-neutral-900 px-2"
        style={{ borderRightWidth: 1.5 }}
      >
        {data.surah}
      </div>
      <div
        className="flex min-w-[64px] items-center justify-center border-r border-neutral-900 px-2"
        style={{ borderRightWidth: 1.5 }}
      >
        {data.revelation}
      </div>
      <div
        className="flex min-w-[40px] items-center justify-center border-r border-neutral-900 px-2"
        style={{ borderRightWidth: 1.5 }}
      >
        {data.pageNo}
      </div>
      <div
        className="flex flex-1 items-center justify-center border-r border-neutral-900 px-2 text-center"
        style={{ borderRightWidth: 1.5 }}
      >
        {data.ayah} • {data.ruku}
      </div>
      <div className="flex min-w-[64px] items-center justify-center px-2">{data.manzil}</div>
    </div>
  );
});
