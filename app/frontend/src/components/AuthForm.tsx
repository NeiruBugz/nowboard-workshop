import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  joinTeamApiTeamsJoinPost,
  signInApiAuthSignInPost,
  signUpApiAuthSignUpPost,
} from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentUserQueryKey } from "@/hooks/useCurrentUser";

const PENDING_INVITE_KEY = "pending_invite_code";

function readPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Ignore — stash is best-effort.
  }
}

type Mode = "sign-in" | "sign-up";

type ParsedError = {
  status: number;
  code: string | null;
};

function parseError(err: unknown): ParsedError {
  const fallback: ParsedError = { status: 0, code: null };
  if (!(err instanceof Error)) return fallback;
  try {
    const payload = JSON.parse(err.message) as Record<string, unknown>;
    const status = typeof payload.status === "number" ? payload.status : 0;
    const body =
      (payload.body as Record<string, unknown> | undefined) ?? payload;
    const rawCode = (body?.error ?? body?.detail) as unknown;
    const code = typeof rawCode === "string" ? rawCode : null;
    return { status, code };
  } catch {
    return fallback;
  }
}

export function AuthForm() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const isSignUp = mode === "sign-up";
  const minPasswordLength = 8;

  const switchMode = (next: Mode, preservePassword = false) => {
    setMode(next);
    setFieldError(null);
    setRateLimited(false);
    if (!preservePassword) setPassword("");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    setRateLimited(false);

    if (isSignUp && password.length < minPasswordLength) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpApiAuthSignUpPost({ body: { email, password } });
      } else {
        await signInApiAuthSignInPost({ body: { email, password } });
      }

      const pendingInvite = readPendingInvite();
      if (pendingInvite) {
        try {
          await joinTeamApiTeamsJoinPost({
            body: { invite_code: pendingInvite, confirm_switch: false },
          });
        } catch {
          // Surface nothing — clear the stash so AuthGate routes naturally
          // (e.g. to onboarding) instead of looping back here.
        } finally {
          clearPendingInvite();
        }
      }

      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    } catch (err) {
      const { status, code } = parseError(err);
      if (status === 429 || code === "rate_limited") {
        setRateLimited(true);
      } else if (isSignUp) {
        if (status === 409 || code === "email_taken") {
          setFieldError(
            "An account with this email already exists. Try signing in.",
          );
        } else if (status === 422) {
          setFieldError("Password must be at least 8 characters.");
        } else {
          setFieldError("Something went wrong. Please try again.");
        }
      } else {
        if (status === 401 || code === "invalid_credentials") {
          setFieldError("Email or password is incorrect.");
        } else if (status === 422) {
          setFieldError("Please enter a valid email and password.");
        } else {
          setFieldError("Something went wrong. Please try again.");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showEmailTakenSwitch =
    isSignUp && fieldError?.startsWith("An account with this email");

  return (
    <main className="min-h-svh flex items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSignUp ? "Create your Nowboard account" : "Sign in to Nowboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp
              ? "Use your work email and a password you'll remember."
              : "Enter your email and password to continue."}
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Authentication mode"
          className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            onClick={() => switchMode("sign-in")}
            className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
              !isSignUp
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            onClick={() => switchMode("sign-up")}
            className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
              isSignUp
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={isSignUp ? minPasswordLength : undefined}
              maxLength={128}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder={isSignUp ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          {rateLimited && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              Too many attempts — try again in a few minutes.
            </div>
          )}

          {fieldError && !rateLimited && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
              {showEmailTakenSwitch && (
                <button
                  type="button"
                  onClick={() => switchMode("sign-in", true)}
                  className="text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Switch to sign in
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !email || !password}
          >
            {submitting
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
