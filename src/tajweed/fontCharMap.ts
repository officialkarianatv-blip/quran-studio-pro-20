/**
 * Tajweed Icon Font — public API
 * ------------------------------
 * Source of truth for tajweed rule → glyph mapping. Backed by the
 * `tajweed-symbols.woff2` font built by scripts/build-tajweed-font.mjs.
 *
 * Consumers should render `TAJWEED_CHAR[id]` inside a `<span class="tajweed-icon">`
 * (see @font-face + .tajweed-icon class in src/styles.css) instead of importing
 * individual SVG assets.
 */

export type TopSymbolId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** PUA codepoint per rule id — kept in sync with fontCharMap.generated.ts. */
export const TAJWEED_CHAR: Record<TopSymbolId, string> = {
  1: "\uE001",
  2: "\uE002",
  3: "\uE003",
  4: "\uE004",
  5: "\uE005",
  6: "\uE006",
  7: "\uE007",
  8: "\uE008",
  9: "\uE009",
  10: "\uE00A",
  11: "\uE00B",
  12: "\uE00C",
};

export const TAJWEED_RULE_NAMES: Record<TopSymbolId, string> = {
  1: "মদ্দ-এ-আসলি",
  2: "আরযি সাকিন (ওয়াকফ)",
  3: "মদ্দ-এ-মুনফাসিল",
  4: "মদ্দ-এ-মুত্তাসিল",
  5: "মদ্দ-এ-ইওয়াদ",
  6: "মদ্দ + আরযি সাকিন",
  7: "ওয়াজিব গুন্নাহ (মীম/নুন শদ্দা)",
  8: "ক্বলক্বলাহ",
  9: "লেক্সিক্যাল ব্যতিক্রম",
  10: "শিস (ز س ص)",
  11: "ইখফা (নুন সাকিন/তানওয়িন)",
  12: "ওয়াকফের শেষ অক্ষর",
};

export const ALL_RULE_IDS: TopSymbolId[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
