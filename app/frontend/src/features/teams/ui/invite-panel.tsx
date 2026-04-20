import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { regenerateCurrentInviteApiTeamsCurrentInviteRegeneratePost } from "@/shared/api/generated";
import { currentUserQueryKey } from "@/shared/model/use-current-user";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type Props = { inviteUrl: string };

type Status = "idle" | "copied" | "regenerated";

export function InvitePanel({ inviteUrl }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1500);
    return () => window.clearTimeout(timer);
  }, [status]);

  const regenerate = useMutation({
    mutationFn: async () => {
      await regenerateCurrentInviteApiTeamsCurrentInviteRegeneratePost();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      setStatus("regenerated");
    },
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus("copied");
    } catch {
      setStatus("idle");
    }
  };

  const message =
    status === "copied" ? "Copied!" : status === "regenerated" ? "Link regenerated" : "";

  return (
    <div className="w-full max-w-md space-y-2 rounded-lg border border-border bg-card p-4">
      <Label htmlFor="invite-url" className="text-xs uppercase tracking-wide text-muted-foreground">
        Invite link
      </Label>
      <div className="flex gap-2">
        <Input
          id="invite-url"
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 font-mono text-xs"
        />
        <Button type="button" variant="secondary" onClick={onCopy}>
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
        >
          {regenerate.isPending ? "Regenerating..." : "Regenerate link"}
        </Button>
      </div>
      <p
        aria-live="polite"
        className={`h-4 text-xs text-muted-foreground transition-opacity duration-300 ${
          status !== "idle" ? "opacity-100" : "opacity-0"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
