import { memo } from "react";

type Props = { para: string; title: string; chapter: string };

/** Kariana 3-cell page header — narrow side cells, wide center, black double border. */
export const SlimHeader = memo(function SlimHeader({ para, title, chapter }: Props) {
  return (
    <div
      className="flex h-full w-full items-stretch bg-white text-[10.5px] font-semibold text-neutral-900"
      style={{
        fontFamily: "var(--font-bangla)",
        border: "1.5px solid #111",
        boxShadow: "inset 0 0 0 1px #fff, inset 0 0 0 2px #111",
        borderRadius: 2,
      }}
    >
      <div
        className="flex min-w-[60px] items-center justify-center border-r border-neutral-900 px-2"
        style={{ borderRightWidth: 1.5 }}
      >
        {para}
      </div>
      <div className="flex flex-1 items-center justify-center px-2 text-center leading-tight">
        {title}
      </div>
      <div
        className="flex min-w-[60px] items-center justify-center border-l border-neutral-900 px-2"
        style={{ borderLeftWidth: 1.5 }}
      >
        {chapter}
      </div>
    </div>
  );
});
