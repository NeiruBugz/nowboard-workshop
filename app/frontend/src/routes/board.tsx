import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { InvitePanel } from "@/components/InvitePanel";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useSignOut } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/board")({
  component: Board,
});

function Board() {
  const navigate = useNavigate();
  const { currentTeam } = useCurrentUser();
  const signOut = useSignOut();

  useEffect(() => {
    if (!currentTeam) {
      navigate({ to: "/onboarding" });
    }
  }, [currentTeam, navigate]);

  if (!currentTeam) {
    return null;
  }

  return (
    <main className="min-h-svh bg-background px-6 py-8">
      <div className="absolute right-6 top-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          {signOut.isPending ? "Signing out..." : "Sign out"}
        </Button>
      </div>
      <div className="mx-auto flex max-w-3xl flex-col items-center space-y-8 pt-12">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Team {currentTeam.team.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your board lives here — cards and columns are coming next.
          </p>
        </header>

        <InvitePanel inviteUrl={currentTeam.invite_url} />
      </div>
    </main>
  );
}
