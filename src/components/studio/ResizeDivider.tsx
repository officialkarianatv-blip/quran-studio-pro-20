import { useCallback, useRef } from "react";

type Props = {
  /** Called with pixel delta on every pointer move while dragging */
  onResize: (delta: number) => void;
};

/**
 * ResizeDivider — a thin draggable handle between two panels.
 *
 * Usage:
 *   <ResizeDivider onResize={(delta) => setWidth(w => clamp(w + delta))} />
 *
 * How it works:
 * 1. onPointerDown  → capture pointer, record starting X position
 * 2. onPointerMove  → compute delta from last position, call onResize(delta)
 * 3. onPointerUp    → release pointer capture, stop dragging
 *
 * Pointer capture ensures we keep receiving events even if the mouse
 * moves outside the element (critical for fast drags).
 */
export function ResizeDivider({ onResize }: Props) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary mouse button (0) or touch
    if (e.button !== 0 && e.button !== -1) return;
    isDragging.current = true;
    lastX.current = e.clientX;
    // Pointer capture: keeps receiving events even when mouse leaves element
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault(); // prevent text selection while dragging
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const delta = e.clientX - lastX.current;
    lastX.current = e.clientX;
    if (delta !== 0) onResize(delta);
  }, [onResize]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="প্যানেল সাইজ পরিবর্তন করুন"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="group relative z-10 flex w-1 flex-shrink-0 cursor-col-resize
                 items-center justify-center bg-neutral-800/60
                 transition-colors hover:bg-amber-500/40 active:bg-amber-500/70
                 select-none"
    >
      {/* Visual drag indicator — 3 dots, visible on hover */}
      <div className="absolute flex flex-col items-center gap-[3px]
                      opacity-0 transition-opacity group-hover:opacity-100">
        <span className="block h-1 w-1 rounded-full bg-amber-400" />
        <span className="block h-1 w-1 rounded-full bg-amber-400" />
        <span className="block h-1 w-1 rounded-full bg-amber-400" />
      </div>
    </div>
  );
}
