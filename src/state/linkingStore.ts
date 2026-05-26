import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LinkingState = {
  arabic: boolean;
  bangla: boolean;
  symbol: boolean;
  setLink: (k: "arabic" | "bangla" | "symbol", v: boolean) => void;
  setAll: (v: boolean) => void;
};

export const useLinkingStore = create<LinkingState>()(
  persist(
    (set) => ({
      arabic: false,
      bangla: false,
      symbol: false,
      setLink: (k, v) => set((s) => ({ ...s, [k]: v })),
      setAll: (v) => set({ arabic: v, bangla: v, symbol: v }),
    }),
    { name: "studio-linking-v1" },
  ),
);
