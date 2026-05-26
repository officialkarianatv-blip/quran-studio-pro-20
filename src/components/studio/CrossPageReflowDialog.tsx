import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEditorStore } from "@/state/editorStore";

/**
 * Mounted once at Workspace level. Listens to editorStore.pendingReflow.
 * Shows a confirmation when an Enter / paste action would cause text to
 * overflow into another page or another surah.
 */
export function CrossPageReflowDialog() {
  const pending = useEditorStore((s) => s.pendingReflow);
  const setPending = useEditorStore((s) => s.setPendingReflow);

  const open = pending !== null;

  const handleConfirm = () => {
    const p = pending;
    setPending(null);
    if (p) {
      try {
        p.confirm();
      } catch (e) {
        console.error("[CrossPageReflowDialog] confirm failed", e);
      }
    }
  };

  const handleCancel = () => {
    const p = pending;
    setPending(null);
    if (p?.cancel) {
      try {
        p.cancel();
      } catch (e) {
        console.error("[CrossPageReflowDialog] cancel failed", e);
      }
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>লেআউট পরিবর্তন নিশ্চিত করুন?</AlertDialogTitle>
          <AlertDialogDescription>
            আপনি সাধারণ / সুরা / পেজ / মডিফিকেশনের জন্য সম্পূর্ণ কুরআন এর পেজ কমবেশি বা
            সকল সুরার পজিশনে প্রভাব পড়ছে।
            {pending?.affectedPages ? (
              <>
                {" "}
                মোট <strong>{pending.affectedPages}</strong> টি পেজ প্রভাবিত হবে।
              </>
            ) : null}
            <br />
            আপনি কি সকল মুডে প্রভাব করতে চান?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>বাতিল</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            হ্যাঁ, পরিবর্তন করুন
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
