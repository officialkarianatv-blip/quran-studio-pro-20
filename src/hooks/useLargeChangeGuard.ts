import { useState, useCallback } from "react";
import { toast } from "sonner";

import { useReflowStore } from "@/state/reflowStore";
import type { SelectionScope } from "@/state/editorStore";
import type { ScopeImpactWarningDialogProps } from "@/components/studio/ScopeImpactWarningDialog";

export type GuardOptions = {
  scope: SelectionScope;
  estimatedRows: number;
  /** Threshold above which the dialog is shown. Default 20. */
  threshold?: number;
  /** Run the actual work. May be async. */
  action: () => void | Promise<void>;
  /** Optional progress label (Bengali). */
  label?: string;
};

type Pending = {
  scope: SelectionScope;
  estimatedRows: number;
  label: string;
  action: () => void | Promise<void>;
};

const DEFAULT_THRESHOLD = 20;

/**
 * Gates an action behind a Bengali warning dialog when scope is surah/global
 * OR when estimated affected rows exceed the threshold. While the action
 * runs, populates `useReflowStore.buildProgress` so the existing progress UI
 * surfaces a bar.
 */
export function useLargeChangeGuard(): {
  request: (opts: GuardOptions) => void;
  dialogProps: ScopeImpactWarningDialogProps;
} {
  const [pending, setPending] = useState<Pending | null>(null);

  const run = useCallback(async (p: Pending) => {
    const set = useReflowStore.setState;
    set({ buildProgress: { label: p.label, pct: 10 } });
    // Yield once so the progress bar paints before sync work.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    set({ buildProgress: { label: p.label, pct: 60 } });
    try {
      await p.action();
      set({ buildProgress: { label: p.label, pct: 100 } });
      toast.success("পরিবর্তন সম্পন্ন হয়েছে");
    } catch (err) {
      console.error("[useLargeChangeGuard] action failed", err);
      toast.error("পরিবর্তন প্রয়োগে ত্রুটি হয়েছে");
    } finally {
      setTimeout(() => useReflowStore.setState({ buildProgress: null }), 400);
    }
  }, []);

  const request = useCallback(
    (opts: GuardOptions) => {
      const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
      const label = opts.label ?? "পরিবর্তন প্রয়োগ হচ্ছে…";
      const requiresDialog =
        opts.scope === "surah" ||
        opts.scope === "global" ||
        opts.estimatedRows >= threshold;

      const p: Pending = {
        scope: opts.scope,
        estimatedRows: opts.estimatedRows,
        label,
        action: opts.action,
      };

      if (!requiresDialog) {
        // Run inline without progress UI for small changes.
        void Promise.resolve(opts.action()).catch((err) => {
          console.error("[useLargeChangeGuard] inline action failed", err);
          toast.error("পরিবর্তন প্রয়োগে ত্রুটি হয়েছে");
        });
        return;
      }
      setPending(p);
    },
    [],
  );

  const dialogProps: ScopeImpactWarningDialogProps = {
    open: pending !== null,
    scope: pending?.scope ?? "general",
    affectedRows: pending?.estimatedRows ?? 0,
    onConfirm: () => {
      const p = pending;
      setPending(null);
      if (p) void run(p);
    },
    onCancel: () => setPending(null),
  };

  return { request, dialogProps };
}
