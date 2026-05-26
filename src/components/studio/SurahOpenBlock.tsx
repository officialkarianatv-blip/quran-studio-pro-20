import { memo } from "react";
import { ARABIC_FONT_PX, BANGLA_FONT_PX } from "./FabricLines";

type Props = {
  surahName: string;
  revelation: string;
  ayah: string | number;
  ruku: string | number;
  bismillahArabic: string;
  bismillahBangla: string;
  width: number;
  height: number;
  arabicFamily: string;
};

/** Compact 2-band surah opening: ornate SVG frame + name plate + bismillah strip. */
export const SurahOpenBlock = memo(function SurahOpenBlock({
  surahName,
  revelation,
  ayah,
  ruku,
  bismillahArabic,
  bismillahBangla,
  width,
  height,
  arabicFamily,
}: Props) {
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        backgroundImage: "url(/templates/surah-open.svg)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Name plate (top) */}
      <div
        style={{
          position: "absolute",
          left: "27.5%",
          top: "21%",
          width: "45%",
          height: "22%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "'Kalpurush', 'Noto Serif Bengali', serif",
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        <span>{surahName}</span>
        <span style={{ color: "#b91c1c", fontSize: 11 }}>{revelation}</span>
        <span style={{ color: "#374151", fontSize: 11 }}>
          আয়াত-{ayah} · রুকু-{ruku}
        </span>
      </div>

      {/* Bismillah strip (bottom) */}
      <div
        style={{
          position: "absolute",
          left: "7.5%",
          top: "50%",
          width: "85%",
          height: "28%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          dir="rtl"
          lang="ar"
          style={{ fontFamily: arabicFamily, fontSize: ARABIC_FONT_PX * 0.7, color: "#111827", lineHeight: 1 }}
        >
          {bismillahArabic}
        </div>
        <div
          lang="bn"
          style={{
            fontFamily: "'Kalpurush', 'Noto Serif Bengali', serif",
            fontSize: BANGLA_FONT_PX,
            color: "#065f46",
            marginTop: 2,
          }}
        >
          {bismillahBangla}
        </div>
      </div>
    </div>
  );
});
