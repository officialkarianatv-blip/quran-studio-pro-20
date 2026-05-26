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
import type { SelectionScope } from "@/state/editorStore";

const SCOPE_LABEL_BN: Record<SelectionScope, string> = {
  general: "সাধারণ",
  page: "পেজ",
  surah: "সূরা",
  global: "সকল",
};

export type ScopeImpactWarningDialogProps = {
  open: boolean;
  scope: SelectionScope;
  affectedRows: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ScopeImpactWarningDialog({
  open,
  scope,
  affectedRows,
  onConfirm,
  onCancel,
}: ScopeImpactWarningDialogProps) {
  const label = SCOPE_LABEL_BN[scope];
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>বড় পরিবর্তনের সতর্কতা</AlertDialogTitle>
          <AlertDialogDescription>
            আপনি <strong>{label}</strong> মোডে এডিট করছেন। এই পরিবর্তনের ফলে আনুমানিক{" "}
            <strong>{affectedRows}</strong> টি লাইনে প্রভাব পড়বে। আপনি কি চালিয়ে যেতে চান?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>না</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>হ্যাঁ, চালিয়ে যান</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
