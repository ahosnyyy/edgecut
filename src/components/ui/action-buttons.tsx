import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Spinner } from "./spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { SaveIcon, Delete02Icon, SentIcon, ArchiveArrowDownIcon, AlertCircleIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { apiFetch } from "../../auth/apiClient";

interface SaveButtonProps {
  onClick: () => void;
  isPending: boolean;
  isCreate?: boolean;
  disabled?: boolean;
  label?: string;
  onCancel?: () => void;
  cancelDisabled?: boolean;
}

function SaveButton({ onClick, isPending, isCreate, disabled, label, onCancel, cancelDisabled }: SaveButtonProps) {
  const text = label ?? (isCreate ? "Create" : "Save");
  return (
    <>
      {onCancel && (
        <Button variant="ghost" onClick={onCancel} disabled={cancelDisabled ?? isPending}>
          Cancel
        </Button>
      )}
      <Button onClick={onClick} disabled={disabled || isPending} className="gap-1.5">
        {isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={isCreate ? SentIcon : SaveIcon} size={14} />}
        {isPending ? (isCreate ? "Creating..." : "Saving...") : text}
      </Button>
    </>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
  isPending: boolean;
  disabled?: boolean;
  label?: string;
}

function DeleteButton({ onClick, isPending, disabled, label }: DeleteButtonProps) {
  return (
    <AlertDialogAction
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
      onClick={onClick}
      disabled={disabled || isPending}
    >
      {isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={Delete02Icon} size={14} />}
      {isPending ? "Deleting..." : (label ?? "Delete")}
    </AlertDialogAction>
  );
}

export { SaveButton, DeleteButton, ConfirmDialog, DeleteGuardDialog };

interface UsageReference {
  type: string;
  id: string;
  name: string;
  detail?: string;
}

interface UsageCheckResult {
  canDelete: boolean;
  references: UsageReference[];
}

const referenceTypeLabels: Record<string, string> = {
  apartment_template: "Apartment Template",
  piece_template: "Piece Template",
  project: "Project",
  stock_catalog: "Stock Catalog",
  project_stock: "Project Stock",
};

interface DeleteGuardDialogProps {
  trigger: ReactNode;
  usageCheckUrl: string;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  entityName?: string;
}

function DeleteGuardDialog({
  trigger,
  usageCheckUrl,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  isPending = false,
  entityName,
}: DeleteGuardDialogProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [usage, setUsage] = useState<UsageCheckResult | null>(null);

  const handleOpenChange = async (next: boolean) => {
    if (next) {
      setChecking(true);
      setUsage(null);
      try {
        const result = await apiFetch<UsageCheckResult>(usageCheckUrl);
        setUsage(result);
      } catch {
        setUsage({ canDelete: true, references: [] });
      } finally {
        setChecking(false);
      }
    }
    setOpen(next);
  };

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={trigger as any} />
      <AlertDialogContent className="sm:max-w-md" onOverlayClick={() => setOpen(false)}>
        {checking ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Checking references…</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="flex items-center justify-center py-6">
              <Spinner className="size-5" />
            </div>
          </>
        ) : usage && !usage.canDelete ? (
          <>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <HugeiconsIcon icon={AlertCircleIcon} size={18} className="text-destructive mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <AlertDialogTitle className="text-destructive">Cannot delete{entityName ? ` "${entityName}"` : ""}</AlertDialogTitle>
                  <AlertDialogCancel className="size-6 text-muted-foreground hover:text-foreground" variant="ghost">
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    <span className="sr-only">Close</span>
                  </AlertDialogCancel>
                </div>
                <AlertDialogDescription>
                  This item is still in use. Remove all references before deleting:
                </AlertDialogDescription>
                <div className="rounded-lg border bg-muted/30 p-2">
                  <ul className="space-y-2">
                    {usage.references.map((ref, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium">{referenceTypeLabels[ref.type] ?? ref.type}</span>
                        <span className="text-muted-foreground truncate">{ref.name}{ref.detail ? ` — ${ref.detail}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={Delete02Icon} size={14} />}
                {isPending ? "Deleting..." : confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  variant?: "destructive" | "default";
}

function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  isPending = false,
  variant = "destructive",
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  const isDestructive = variant === "destructive";
  const icon = isDestructive ? Delete02Icon : ArchiveArrowDownIcon;
  const pendingLabel = isDestructive ? "Deleting..." : "Archiving...";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger as any} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                : "gap-1.5"
            }
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={icon} size={14} />}
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
