import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { createTeamApiTeamsPost, updateMeApiUsersMePatch } from "@/shared/api/generated";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { currentUserQueryKey, useCurrentUser } from "@/shared/model/useCurrentUser";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { needsDisplayName, hasTeam } = useCurrentUser();

  if (needsDisplayName) {
    return <DisplayNameStep />;
  }
  if (!hasTeam) {
    return <TeamStep />;
  }
  return null;
}

function DisplayNameStep() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = displayName.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 40;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateMeApiUsersMePatch({ body: { display_name: trimmed } });
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      // AuthGate / Onboarding will route to the team step on the next render.
    } catch {
      setError("We couldn't save your name. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-svh flex items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            What's your name?
          </h1>
          <p className="text-sm text-muted-foreground">
            Teammates will see this on cards you post.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              type="text"
              required
              minLength={1}
              maxLength={40}
              autoComplete="name"
              autoFocus
              placeholder="Jane Doe"
              aria-label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !isValid}
          >
            {submitting ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function TeamStep() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = teamName.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 40;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      await createTeamApiTeamsPost({ body: { name: trimmed } });
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      navigate({ to: "/board" });
    } catch {
      setError("We couldn't create your team. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-svh flex items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Set up your team
          </h1>
          <p className="text-sm text-muted-foreground">
            You'll get a shareable invite link as soon as it's created.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              type="text"
              required
              minLength={2}
              maxLength={40}
              autoFocus
              placeholder="Platform Squad"
              aria-label="Team name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !isValid}
          >
            {submitting ? "Creating..." : "Create team"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          or join an existing one with an invite link
        </p>
      </div>
    </main>
  );
}
