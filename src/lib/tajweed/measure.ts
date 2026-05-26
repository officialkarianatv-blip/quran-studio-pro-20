// Measure the visual x-center of a logical character index inside an Arabic
// <span>. Cluster-aware: the target base character is grouped with its
// trailing combining marks (tashkeel, dagger-alif, small-high marks, ZW*)
// so RTL bidi, justification, kashida and ligature shaping all map back to a
// stable on-screen rectangle.

const COMBINING_RE =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u200C\u200D\u2060\uFEFF]/;

function clusterEnd(text: string, start: number): number {
  let end = start + 1;
  while (end < text.length && COMBINING_RE.test(text[end])) end += 1;
  return end;
}

function bestRect(range: Range): DOMRect | null {
  const rects = range.getClientRects();
  let best: DOMRect | null = null;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.width === 0 && r.height === 0) continue;
    if (!best || r.width * r.height > best.width * best.height) best = r;
  }
  if (best) return best;
  const r = range.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

export function measureCharCenter(
  span: HTMLElement,
  layer: HTMLElement,
  charIndex: number,
): number | null {
  // Find the text node and local offset corresponding to the absolute charIndex.
  let currentOffset = 0;
  let targetNode: Text | null = null;
  let localIndex = 0;

  function traverse(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue?.length ?? 0;
      if (charIndex >= currentOffset && charIndex < currentOffset + len) {
        targetNode = node as Text;
        localIndex = charIndex - currentOffset;
        return true; // found
      }
      currentOffset += len;
    } else {
      for (const child of node.childNodes) {
        if (traverse(child)) return true;
      }
    }
    return false;
  }

  traverse(span);

  if (!targetNode) return null;
  // targetNode is Text, so nodeValue is guaranteed non-null; cast for TS flow
  const text: string = (targetNode as Text).nodeValue ?? "";



  try {
    const range = document.createRange();
    const end = clusterEnd(text, localIndex);
    range.setStart(targetNode, localIndex);
    range.setEnd(targetNode, end);
    let rect = bestRect(range);

    // Fallback: expand to include the previous cluster (helps with ligatures
    // that collapse the base char into an adjacent shape).
    if (!rect && localIndex > 0) {
      const r2 = document.createRange();
      r2.setStart(targetNode, Math.max(0, localIndex - 1));
      r2.setEnd(targetNode, end);
      rect = bestRect(r2);
    }
    // Fallback: extend to the next cluster.
    if (!rect && end < text.length) {
      const r3 = document.createRange();
      r3.setStart(targetNode, localIndex);
      r3.setEnd(targetNode, clusterEnd(text, end));
      rect = bestRect(r3);
    }
    if (!rect) return null;

    const base = layer.getBoundingClientRect();
    return rect.left + rect.width / 2 - base.left;
  } catch {
    return null;
  }
}
