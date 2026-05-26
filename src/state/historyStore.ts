import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SelectionScope } from "./editorStore";
import type { GlobalOverrides, LocalOverride } from "./overridesStore";

/* ─── Types ──────────────────────────────────────────────────────── */

/**
 * A single field-level diff patch stored per history entry.
 * Much smaller than storing full snapshots — only the changed field is kept.
 */
export type HistoryPatch = {
  /** Field name (e.g. "arabicFontPx", "text", "dx") */
  field: string;
  /** The layerKey for local overrides, undefined for global changes */
  layerKey?: string;
  /** Value BEFORE the change */
  before: unknown;
  /** Value AFTER the change */
  after: unknown;
};

export type HistoryEntry = {
  id: string;
  ts: number;
  label: string;
  labelBn: string;
  scope: SelectionScope;
  /** Human-readable scope context, e.g. "পেজ ৫ · সারি ৩" */
  scopeLabel?: string;
  pageId?: string;
  rowIndex?: number;
  /** Which layer key was changed (e.g. layer:pageId:rowIndex:arabic) */
  layerKey?: string;
  field: string;
  before: unknown;
  after: unknown;
  /**
   * Diff-based patch — stores ONLY the changed field+value.
   * Replaces the old `beforeSnapshot` + `snapshot` full-copy approach.
   * Memory savings: ~100x smaller per entry for large projects.
   */
  patch: HistoryPatch;
};

/** Legacy type — kept for migration compatibility only */
type LegacyHistoryEntry = HistoryEntry & {
  beforeSnapshot?: { global: GlobalOverrides; local: Record<string, LocalOverride> };
  snapshot?: { global: GlobalOverrides; local: Record<string, LocalOverride> };
};

const MAX_ENTRIES = 200;

/* ─── Field human labels ─────────────────────────────────────────── */
export const FIELD_LABELS_BN: Record<string, string> = {
  arabicFontPx:  "আরবি ফন্ট সাইজ",
  banglaFontPx:  "বাংলা ফন্ট সাইজ",
  symbolScale:   "প্রতীক স্কেল",
  arabicYOffset: "আরবি Y অফসেট",
  banglaYOffset: "বাংলা Y অফসেট",
  symbolYOffset: "প্রতীক Y অফসেট",
  rowSpacing:    "সারি ব্যবধান",
  dx:            "X অফসেট",
  dy:            "Y অফসেট",
  fontPx:        "ফন্ট সাইজ",
  scale:         "স্কেল",
  text:          "টেক্সট পরিবর্তন",
  leading:       "লাইন স্পেসিং",
  tracking:      "অক্ষর ব্যবধান",
  align:         "সারিবদ্ধতা",
};

/** Default per-field values. If a change is `undefined → default`, we treat it
 *  as a no-op and skip pushing a history entry. */
export const FIELD_DEFAULTS: Record<string, unknown> = {
  dx: 0,
  dy: 0,
  fontPx: 0,
  leading: 0,
  tracking: 0,
  baseline: 0,
  vScale: 100,
  hScale: 100,
  align: "justify",
  scale: 1,
};

export function formatVal(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v);
}

/** Bengali scope suffix for history entry titles, e.g. "ফন্ট সাইজ (সূরা)". */
export const SCOPE_SUFFIX_BN: Record<SelectionScope, string> = {
  general: "",
  page: " (পেজ)",
  surah: " (সূরা)",
  global: " (সকল)",
};

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff} সেকেন্ড আগে`;
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
}
export { relativeTime };

/* ─── Silent mode (used during inline text edits / bulk restores) ──
 *  Increment with beginSilent() and decrement with endSilent(). While > 0,
 *  captureHistory() becomes a no-op. */
let _silent = 0;
export function beginSilent() { _silent += 1; }
export function endSilent() { _silent = Math.max(0, _silent - 1); }
export function isSilent() { return _silent > 0; }

/* ─── Patch Application ──────────────────────────────────────────── */

/**
 * Apply a single patch to the overrides store (forward direction).
 * Uses `after` value.
 */
async function applyPatchForward(patch: HistoryPatch) {
  const { useOverridesStore, setRestoringHistory } = await import("./overridesStore");
  const store = useOverridesStore.getState();
  setRestoringHistory(true);
  try {
    if (patch.layerKey) {
      store.patchLocal(patch.layerKey, { [patch.field]: patch.after } as Partial<LocalOverride>);
    } else {
      store.setGlobal(patch.field as keyof GlobalOverrides, patch.after as GlobalOverrides[keyof GlobalOverrides]);
    }
  } finally {
    setRestoringHistory(false);
  }
}

/**
 * Apply a single patch in reverse (undo direction).
 * Uses `before` value.
 */
async function applyPatchReverse(patch: HistoryPatch) {
  const { useOverridesStore, setRestoringHistory } = await import("./overridesStore");
  const store = useOverridesStore.getState();
  setRestoringHistory(true);
  try {
    if (patch.layerKey) {
      store.patchLocal(patch.layerKey, { [patch.field]: patch.before } as Partial<LocalOverride>);
    } else {
      store.setGlobal(patch.field as keyof GlobalOverrides, patch.before as GlobalOverrides[keyof GlobalOverrides]);
    }
  } finally {
    setRestoringHistory(false);
  }
}

/**
 * Restore to the state AFTER entry `targetId` by replaying all patches
 * forward from the beginning up to and including `targetId`.
 *
 * For performance, we only replay the net diff from the last known cursor
 * position. In practice, history restore is rare so O(N) replay is fine.
 */
async function restoreToImpl(entries: HistoryEntry[], targetId: string) {
  const targetIdx = entries.findIndex((e) => e.id === targetId);
  if (targetIdx === -1) return;

  const { useOverridesStore, MASTER_DEFAULTS, setRestoringHistory, getSessionBaseline } = await import("./overridesStore");
  const store = useOverridesStore.getState();

  setRestoringHistory(true);
  try {
    // Reset to session baseline (or MASTER_DEFAULTS if no session has started yet),
    // then replay all patches up to targetIdx
    const baseline = getSessionBaseline();
    if (baseline) {
      useOverridesStore.setState({
        global: { ...MASTER_DEFAULTS, ...baseline.global },
        local: { ...baseline.local },
      });
    } else {
      store.resetAll();
    }
    for (let i = 0; i <= targetIdx; i++) {
      const e = entries[i];
      if (e.patch.layerKey) {
        store.patchLocal(e.patch.layerKey, { [e.patch.field]: e.patch.after } as Partial<LocalOverride>);
      } else {
        const field = e.patch.field as keyof GlobalOverrides;
        const val = e.patch.after as GlobalOverrides[keyof GlobalOverrides];
        store.setGlobal(field, val ?? MASTER_DEFAULTS[field]);
      }
    }
  } finally {
    setRestoringHistory(false);
  }
}

/* ─── Store ──────────────────────────────────────────────────────── */
type HistoryState = {
  entries: HistoryEntry[];
  /** Timestamp set when the editor panel opens. Entries before this are from prior sessions. */
  sessionStartTs: number;
  push: (entry: Omit<HistoryEntry, "id" | "ts">) => void;
  /** Replay all patches up to and including entry `id`. */
  restoreTo: (id: string) => void;
  /**
   * Apply a single patch in reverse (preview-previous).
   */
  applyPatchReverse: (patch: HistoryPatch) => void;
  /** @deprecated Use applyPatchReverse. Kept for API compatibility. */
  applySnapshot: (patch: HistoryPatch) => void;
  clear: () => void;
  /** Called when the editor panel mounts to start a fresh session stack. */
  markSessionStart: () => void;
  /** All entries from the current session (ts >= sessionStartTs). */
  sessionEntries: () => HistoryEntry[];
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      sessionStartTs: Date.now(),

      push: (entry) => {
        const newEntry: HistoryEntry = {
          ...entry,
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ts: Date.now(),
        };
        set((s) => ({
          entries:
            s.entries.length >= MAX_ENTRIES
              ? [...s.entries.slice(1), newEntry]
              : [...s.entries, newEntry],
        }));
      },

      restoreTo: (id) => {
        const { entries, sessionStartTs } = get();
        void restoreToImpl(entries.filter((e) => e.ts >= sessionStartTs), id);
      },

      applyPatchReverse: (patch) => { void applyPatchReverse(patch); },

      applySnapshot: (patch) => { void applyPatchReverse(patch); },

      clear: () => set({ entries: [] }),

      markSessionStart: () => {
        set({ sessionStartTs: Date.now() });
        // Also clear the Zundo temporal undo/redo stack so it starts fresh
        void import("./overridesStore").then(({ useOverridesStore }) => {
          (useOverridesStore.temporal.getState() as { clear?: () => void }).clear?.();
        });
      },

      sessionEntries: () => {
        const { entries, sessionStartTs } = get();
        return entries.filter((e) => e.ts >= sessionStartTs);
      },
    }),
    {
      name: "studio-history-v3",
      // Persist only last 50 entries — patches are tiny so this is safe.
      // sessionStartTs is NOT persisted so each browser session starts fresh.
      partialize: (s) => ({ entries: s.entries.slice(-50) }),
      // Migration: handle both old (v2 full-snapshot) and new (v3 patch) formats
      merge: (persisted, current) => {
        const p = persisted as { entries?: LegacyHistoryEntry[] } | undefined;
        const fixed = (p?.entries ?? []).map((e): HistoryEntry => {
          // Migrate legacy scope values
          const sc = e.scope as unknown as string;
          const mapped: SelectionScope =
            sc === "row" ? "general" : sc === "para" ? "global" : (sc as SelectionScope);

          const deriveScopeLabel = (pid?: string, ri?: number) => {
            if (!pid) return "";
            let s = `পেজ ${pid.replace(/^vpage-/, "")}`;
            if (ri !== undefined) s += ` · সারি ${ri + 1}`;
            return s;
          };

          // If this entry already has a patch (v3 format), keep it
          if (e.patch) {
            return { ...e, scope: mapped, scopeLabel: e.scopeLabel ?? deriveScopeLabel(e.pageId, e.rowIndex) };
          }

          // Migrate from v2 full-snapshot format: reconstruct a patch from field/before/after
          const patch: HistoryPatch = {
            field: e.field,
            layerKey: e.layerKey,
            before: e.before,
            after: e.after,
          };
          // Strip old snapshot fields to save memory
          const { beforeSnapshot: _b, snapshot: _s, ...rest } = e as LegacyHistoryEntry;
          void _b; void _s;
          return { ...rest, scope: mapped, scopeLabel: deriveScopeLabel(e.pageId, e.rowIndex), patch };
        });
        return { ...current, entries: fixed };
      },
    },
  ),
);

/* ─── Auto-capture hook (call from overridesStore after mutations) ─ */
export function captureHistory(
  field: string,
  before: unknown,
  after: unknown,
  scope: SelectionScope,
  pageId?: string,
  rowIndex?: number,
  layerKey?: string,
) {
  if (isSilent()) return;
  // Skip true no-ops
  if (before === after) return;
  // Skip undefined → default-value transitions (noise from UI mount)
  if (before === undefined && Object.prototype.hasOwnProperty.call(FIELD_DEFAULTS, field)) {
    if (after === FIELD_DEFAULTS[field]) return;
  }

  void import("./overridesStore").then(async ({ useOverridesStore }) => {
    void useOverridesStore; // touch import (ensures module is loaded)

    const patch: HistoryPatch = {
      field,
      layerKey,
      before,
      after,
    };

    const fieldLabelBn = FIELD_LABELS_BN[field] ?? field;
    let labelBn: string;
    let label: string;
    if (field === "text") {
      const preview = String(after ?? "").slice(0, 20) + (String(after ?? "").length > 20 ? "…" : "");
      labelBn = `টেক্সট পরিবর্তন: "${preview}"`;
      label = `text: "${preview}"`;
    } else {
      const beforeStr = formatVal(before);
      const afterStr = formatVal(after);
      const scopeSuffix = SCOPE_SUFFIX_BN[scope] ?? "";
      labelBn = `${fieldLabelBn}${scopeSuffix}: ${beforeStr} → ${afterStr}`;
      label = `${field}${scopeSuffix}: ${beforeStr} → ${afterStr}`;
    }

    let scopeLabel = "";
    const pageNum = pageId ? pageId.replace(/^vpage-/, "") : "";
    if (scope === "page" && pageId) {
      scopeLabel = `পেজ ${pageNum}`;
    } else if (scope === "surah" && pageId) {
      try {
        const { useReflowStore } = await import("./reflowStore");
        const surah = useReflowStore.getState().distribution.find((d) => d.pageId === pageId)?.surah;
        scopeLabel = surah ? `সূরা ${surah}` : `পেজ ${pageNum}`;
      } catch {
        scopeLabel = `পেজ ${pageNum}`;
      }
    } else if (scope === "global") {
      scopeLabel = "";
    } else if (pageId) {
      scopeLabel = `পেজ ${pageNum}`;
      if (rowIndex !== undefined) scopeLabel += ` · সারি ${rowIndex + 1}`;
    }


    useHistoryStore.getState().push({
      label,
      labelBn,
      scope,
      scopeLabel,
      pageId,
      rowIndex,
      layerKey,
      field,
      before,
      after,
      patch,
    });
  });
}
