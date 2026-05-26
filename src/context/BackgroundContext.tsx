import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type BgOption = { id: string; label: string; url: string };

const BUILTIN: BgOption[] = [
  { id: "page-default", label: "কারিয়ানা টেমপ্লেট (ডিফল্ট)", url: "/templates/page-default.svg" },
  { id: "default", label: "Ornamental", url: "/templates/default.svg" },
  { id: "none", label: "কোন ব্যাকগ্রাউন্ড নেই", url: "" },
];

type Ctx = {
  backgrounds: BgOption[];
  activeId: string;
  activeUrl: string;
  setActiveId: (id: string) => void;
  uploadBackground: (file: File) => Promise<void>;
};

const BgCtx = createContext<Ctx | null>(null);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgrounds, setBackgrounds] = useState<BgOption[]>(BUILTIN);
  const [activeId, setActiveId] = useState<string>("page-default");

  const uploadBackground = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    const id = `user-bg-${Date.now()}`;
    const opt: BgOption = { id, label: `Uploaded: ${file.name}`, url };
    setBackgrounds((prev) => [...prev, opt]);
    setActiveId(id);
  }, []);

  const activeUrl = backgrounds.find((b) => b.id === activeId)?.url ?? "";

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--page-bg",
      activeUrl ? `url("${activeUrl}")` : "none",
    );
  }, [activeUrl]);

  const value = useMemo<Ctx>(
    () => ({ backgrounds, activeId, activeUrl, setActiveId, uploadBackground }),
    [backgrounds, activeId, activeUrl, uploadBackground],
  );
  return <BgCtx.Provider value={value}>{children}</BgCtx.Provider>;
}

export function useBackground() {
  const ctx = useContext(BgCtx);
  if (!ctx) throw new Error("useBackground must be used inside BackgroundProvider");
  return ctx;
}
