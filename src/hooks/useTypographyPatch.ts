import { useCallback, useMemo } from "react";

import { useFont } from "@/context/FontContext";
import type { SelectionScope } from "@/state/editorStore";
import type { ActiveLayerKind } from "@/state/editorStore";
import type { LocalOverride } from "@/state/overridesStore";
import {
  ARTBOARD_TEXT_WIDTH,
  DEFAULT_BANGLA_FONT_FAMILY,
  countTypographyTargets,
  patchTypographyScoped,
  type TypographyReflowContext,
} from "@/lib/typographyReflow";

import { useLargeChangeGuard } from "./useLargeChangeGuard";

/**
 * Typography patch + reflow with large-change guard (surah/global or ≥20 rows).
 * Mount {@link ScopeImpactWarningDialog} once via `dialogProps`.
 */
export function useTypographyPatch() {
  const { activeFamily } = useFont();
  const { request, dialogProps } = useLargeChangeGuard();

  const ctx: TypographyReflowContext = useMemo(
    () => ({
      arabicFontFamily: activeFamily,
      banglaFontFamily: DEFAULT_BANGLA_FONT_FAMILY,
      availableWidth: ARTBOARD_TEXT_WIDTH,
    }),
    [activeFamily],
  );

  const applyTypography = useCallback(
    (
      representativeKey: string,
      patch: Partial<Record<keyof LocalOverride, LocalOverride[keyof LocalOverride] | undefined>>,
      scope: SelectionScope,
      layer: ActiveLayerKind,
    ) => {
      void (async () => {
        const estimatedRows = await countTypographyTargets(representativeKey, scope, layer);
        request({
          scope,
          estimatedRows: Math.max(1, estimatedRows),
          label: "টাইপোগ্রাফি রিফ্লো প্রয়োগ হচ্ছে…",
          action: () => patchTypographyScoped(representativeKey, patch, scope, ctx, layer),
        });
      })();
    },
    [ctx, request],
  );

  return { applyTypography, dialogProps, ctx };
}
