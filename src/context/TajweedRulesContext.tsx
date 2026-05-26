import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ALL_RULE_IDS, type TopSymbolId } from "@/lib/tajweed/svgMap";

const STORAGE_KEY = "tajweed:enabledRules";

type EnabledMap = Record<TopSymbolId, boolean>;

type Ctx = {
  enabled: EnabledMap;
  isEnabled: (id: TopSymbolId) => boolean;
  setEnabled: (id: TopSymbolId, on: boolean) => void;
  setAll: (on: boolean) => void;
};

const TajweedCtx = createContext<Ctx | null>(null);

const defaultMap = (): EnabledMap =>
  ALL_RULE_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as EnabledMap);

export function TajweedRulesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<EnabledMap>(defaultMap);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EnabledMap>;
        setEnabledState((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled)); } catch { /* ignore */ }
  }, [enabled]);

  const setEnabled = useCallback((id: TopSymbolId, on: boolean) => {
    setEnabledState((prev) => ({ ...prev, [id]: on }));
  }, []);

  const setAll = useCallback((on: boolean) => {
    setEnabledState(() => ALL_RULE_IDS.reduce((acc, id) => {
      acc[id] = on; return acc;
    }, {} as EnabledMap));
  }, []);

  const value = useMemo<Ctx>(() => ({
    enabled,
    isEnabled: (id) => enabled[id] !== false,
    setEnabled,
    setAll,
  }), [enabled, setEnabled, setAll]);

  return <TajweedCtx.Provider value={value}>{children}</TajweedCtx.Provider>;
}

export function useTajweedRules(): Ctx {
  const ctx = useContext(TajweedCtx);
  if (!ctx) {
    // Safe fallback so the renderer never crashes if the provider isn't mounted yet.
    const enabled = defaultMap();
    return {
      enabled,
      isEnabled: () => true,
      setEnabled: () => {},
      setAll: () => {},
    };
  }
  return ctx;
}
