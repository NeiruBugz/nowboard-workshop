import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { joinTeamApiTeamsJoinPost } from "@/shared/api/generated";
import { Button } from "@/shared/ui/button";
import { SwitchTeamDialog } from "@/features/teams";
import { currentUserQueryKey, useCurrentUser } from "@/shared/model/useCurrentUser";

export const PENDING_INVITE_KEY = "pending_invite_code";

export const Route = createFileRoute("/join/$inviteCode")({
  component: JoinRoute,
});

type TeamSummary = { name: string };

type JoinStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "not_found" }
  | {
      kind: "switch_required";
      currentTeam: TeamSummary;
      newTeam: TeamSummary;
    }
  | { kind: "error"; message: string };

function JoinRoute() {
  const { inviteCode } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading } = useCurrentUser();
  const [status, setStatus] = useState<JoinStatus>({ kind: "idle" });
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      try {
        sessionStorage.setItem(PENDING_INVITE_KEY, inviteCode);
      } catch {
        // Ignore storage failures — user can re-open the invite link.
      }
      navigate({ to: "/" });
      return;
    }

    let cancelled = false;
    setStatus({ kind: "pending" });

    (async () => {
      try {
        await joinTeamApiTeamsJoinPost({
          body: { invite_code: inviteCode, confirm_switch: false },
        });
        if (cancelled) return;
        await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
        navigate({ to: "/board" });
      } catch (err) {
        if (cancelled) return;
        const parsed = parseJoinError(err);
        if (parsed.kind === "not_found") {
          setStatus({ kind: "not_found" });
        } else if (parsed.kind === "switch_required") {
          setStatus({
            kind: "switch_required",
            currentTeam: parsed.currentTeam,
            newTeam: parsed.newTeam,
          });
        } else {
          setStatus({
            kind: "error",
            message: "Couldn't join the team. Please try again.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isLoading, inviteCode, navigate, queryClient]);

  const handleCancelSwitch = () => {
    setStatus({ kind: "idle" });
    navigate({ to: "/board" });
  };

  const handleConfirmSwitch = async () => {
    setIsConfirming(true);
    try {
      await joinTeamApiTeamsJoinPost({
        body: { invite_code: inviteCode, confirm_switch: true },
      });
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      setStatus({ kind: "idle" });
      navigate({ to: "/board" });
    } catch {
      setStatus({
        kind: "error",
        message: "Couldn't switch teams. Please try again.",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  if (status.kind === "not_found") {
    return (
      <CenteredCard
        title="Invite link not found"
        body="This invite link is no longer valid or has expired."
        action={{ label: "Go home", onClick: () => navigate({ to: "/" }) }}
      />
    );
  }

  if (status.kind === "error") {
    return (
      <CenteredCard
        title="Something went wrong"
        body={status.message}
        action={{ label: "Go home", onClick: () => navigate({ to: "/" }) }}
      />
    );
  }

  return (
    <>
      <main className="min-h-svh flex items-center justify-center bg-background">
        <div
          aria-label="Joining team"
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        />
      </main>
      {status.kind === "switch_required" ? (
        <SwitchTeamDialog
          open
          currentTeam={status.currentTeam}
          newTeam={status.newTeam}
          onCancel={handleCancelSwitch}
          onConfirm={handleConfirmSwitch}
          isConfirming={isConfirming}
        />
      ) : null}
    </>
  );
}

type CardAction = { label: string; onClick: () => void };

function CenteredCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: CardAction;
}) {
  return (
    <main className="min-h-svh flex items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
        <Button type="button" className="w-full" onClick={action.onClick}>
          {action.label}
        </Button>
      </div>
    </main>
  );
}

type ParsedJoinError =
  | { kind: "not_found" }
  | {
      kind: "switch_required";
      currentTeam: TeamSummary;
      newTeam: TeamSummary;
    }
  | { kind: "other" };

function parseJoinError(err: unknown): ParsedJoinError {
  if (!(err instanceof Error)) return { kind: "other" };
  let payload: unknown;
  try {
    payload = JSON.parse(err.message);
  } catch {
    return { kind: "other" };
  }
  if (!payload || typeof payload !== "object") return { kind: "other" };

  const record = payload as Record<string, unknown>;
  const detail =
    record.detail && typeof record.detail === "object"
      ? (record.detail as Record<string, unknown>)
      : record;

  if (detail.needs_switch_confirm === true) {
    const currentTeam = toTeamSummary(detail.current_team);
    const newTeam = toTeamSummary(detail.new_team);
    if (currentTeam && newTeam) {
      return { kind: "switch_required", currentTeam, newTeam };
    }
  }

  if (detail.error === "invite_not_found") {
    return { kind: "not_found" };
  }

  return { kind: "other" };
}

function toTeamSummary(value: unknown): TeamSummary | null {
  if (!value || typeof value !== "object") return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" ? { name } : null;
}
