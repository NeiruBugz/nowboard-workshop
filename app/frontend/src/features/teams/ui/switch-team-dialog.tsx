import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export type SwitchTeamDialogProps = {
  open: boolean;
  currentTeam: { name: string };
  newTeam: { name: string };
  onCancel: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
};

export function SwitchTeamDialog({
  open,
  currentTeam,
  newTeam,
  onCancel,
  onConfirm,
  isConfirming,
}: SwitchTeamDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isConfirming) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {currentTeam.name}?</DialogTitle>
          <DialogDescription>
            Joining {newTeam.name} will remove you from {currentTeam.name}. You
            can be on only one team at a time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isConfirming}>
            Join {newTeam.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
