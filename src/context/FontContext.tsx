import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type FontOption = { id: string; label: string; family: string };

const DEFAULT_FONTS: FontOption[] = [
  { id: "excellent-arabic", label: "Excellent Arabic (default)", family: "'Excellent Arabic', 'Amiri', serif" },
  { id: "amiri", label: "Amiri", family: "'Amiri', 'Noto Naskh Arabic', serif" },
  { id: "scheherazade", label: "Scheherazade New", family: "'Scheherazade New', serif" },
  { id: "noto", label: "Noto Naskh Arabic", family: "'Noto Naskh Arabic', serif" },
];

type Ctx = {
  fonts: FontOption[];
  activeId: string;
  activeFamily: string;
  setActiveId: (id: string) => void;
  uploadFont: (file: File) => Promise<void>;
};

const FontCtx = createContext<Ctx | null>(null);

export function FontProvider({ children }: { children: ReactNode }) {
  const [fonts, setFonts] = useState<FontOption[]>(DEFAULT_FONTS);
  const [activeId, setActiveId] = useState<string>("excellent-arabic");

  // Load Google web fonts once
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("studio-arabic-webfonts")) return;
    const link = document.createElement("link");
    link.id = "studio-arabic-webfonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Scheherazade+New:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  const uploadFont = useCallback(async (file: File) => {
    const family = `user-${Date.now()}`;
    const url = URL.createObjectURL(file);
    const face = new FontFace(family, `url(${url})`);
    await face.load();
    (document as any).fonts.add(face);
    const opt: FontOption = {
      id: family,
      label: `Uploaded: ${file.name}`,
      family: `'${family}', serif`,
    };
    setFonts((prev) => [...prev, opt]);
    setActiveId(family);
  }, []);

  const activeFamily =
    fonts.find((f) => f.id === activeId)?.family ?? DEFAULT_FONTS[0].family;

  useEffect(() => {
    document.documentElement.style.setProperty("--font-arabic", activeFamily);
  }, [activeFamily]);

  const value = useMemo<Ctx>(
    () => ({ fonts, activeId, activeFamily, setActiveId, uploadFont }),
    [fonts, activeId, activeFamily, uploadFont],
  );

  return <FontCtx.Provider value={value}>{children}</FontCtx.Provider>;
}

const FALLBACK_CTX: Ctx = {
  fonts: DEFAULT_FONTS,
  activeId: "excellent-arabic",
  activeFamily: DEFAULT_FONTS[0].family,
  setActiveId: () => {},
  uploadFont: async () => {},
};

export function useFont(): Ctx {
  const ctx = useContext(FontCtx);
  return ctx ?? FALLBACK_CTX;
}

