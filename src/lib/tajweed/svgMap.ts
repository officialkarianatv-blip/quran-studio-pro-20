// Tajweed symbol mapping — now backed by a custom .woff2 icon font.
// The 12 SVGs in src/assets/tajweed/{1..12}.svg have been compiled into
// public/fonts/tajweed-symbols.woff2 (see scripts/build-tajweed-font.mjs).
//
// This module preserves the legacy import path while re-exporting the new
// font-based API. Consumers render `TAJWEED_CHAR[id]` inside a
// `<span class="tajweed-icon">` (see @font-face in src/styles.css).

export {
  TAJWEED_CHAR,
  TAJWEED_RULE_NAMES,
  ALL_RULE_IDS,
  type TopSymbolId,
} from "@/tajweed/fontCharMap";
