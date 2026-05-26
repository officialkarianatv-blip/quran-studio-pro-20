import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { useReflowStore } from "@/state/reflowStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function QuickPublishModal({ open, onClose }: Props) {
  const totalPages = useReflowStore((s) => s.pages.length);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(Math.max(1, totalPages));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setFromPage(1);
      setToPage(Math.max(1, totalPages));
    }
  }, [open, totalPages]);

  if (!open) return null;

  const clamp = (n: number) => Math.min(Math.max(1, n || 1), Math.max(1, totalPages));
  const count = Math.max(0, toPage - fromPage + 1);
  const disabled = exporting || fromPage > toPage || totalPages === 0;

  const handlePrint = () => {
    setExporting(true);
    try {
      localStorage.setItem("print-range", JSON.stringify({ from: fromPage, to: toPage }));
    } catch {
      // ignore
    }
    // Mark out-of-range artboards so the print stylesheet hides them.
    const allBoards = document.querySelectorAll<HTMLElement>('[data-artboard="true"]');
    allBoards.forEach((el) => {
      const n = Number(el.getAttribute("data-page-num") ?? 0);
      el.dataset.printSkip = n < fromPage || n > toPage ? "true" : "false";
    });
    const cleanup = () => {
      allBoards.forEach((el) => { delete el.dataset.printSkip; });
    };
    window.addEventListener("afterprint", cleanup, { once: true });

    setTimeout(() => {
      window.print();
      setExporting(false);
      onClose();
    }, 200);
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[420px] rounded-2xl border border-neutral-700 bg-neutral-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
            ⚡ Quick Publish
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="বন্ধ করুন"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          {/* Page range */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-neutral-400">পেজ রেঞ্জ</span>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] text-neutral-500">শুরু</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={fromPage}
                  onChange={(e) => setFromPage(clamp(Number(e.target.value)))}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center text-sm text-neutral-200 outline-none focus:border-amber-400"
                />
              </label>
              <span className="pb-1.5 text-neutral-500">—</span>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] text-neutral-500">শেষ</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={toPage}
                  onChange={(e) => setToPage(clamp(Number(e.target.value)))}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center text-sm text-neutral-200 outline-none focus:border-amber-400"
                />
              </label>
            </div>
            <span className="text-[10px] text-neutral-500">
              মোট: {count} পেজ (সর্বোচ্চ {totalPages})
            </span>
          </div>

          {/* Quick select */}
          <div className="flex gap-2">
            <button
              onClick={() => { setFromPage(1); setToPage(Math.max(1, totalPages)); }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
            >
              সব পেজ
            </button>
            <button
              onClick={() => { setFromPage(1); setToPage(Math.min(30, Math.max(1, totalPages))); }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
            >
              প্রথম ৩০
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={handlePrint}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-neutral-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" />
            {exporting ? "প্রিন্ট হচ্ছে…" : "PDF/প্রিন্ট করুন"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
