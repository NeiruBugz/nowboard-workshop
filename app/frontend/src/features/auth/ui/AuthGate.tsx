import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { useCurrentUser } from "@/shared/model/useCurrentUser";

const PUBLIC_ROUTES = new Set(["/"]);

function isPublicRoute(path: string): boolean {
  if (PUBLIC_ROUTES.has(path)) return true;
  if (path.startsWith("/join/")) return true;
  return false;
}
const ONBOARDING_ROUTE = "/onboarding";
const BOARD_ROUTE = "/board";

export type GateState = {
  hasUser: boolean;
  needsDisplayName: boolean;
  hasTeam: boolean;
};

/**
 * Returns the path the user should be on, given their auth state and the
 * current path. `null` means the current path is allowed — render through.
 */
export function resolveDestination(state: GateState, path: string): string | null {
  const { hasUser, needsDisplayName, hasTeam } = state;
  const isPublic = isPublicRoute(path);

  if (!hasUser) {
    return isPublic ? null : "/";
  }

  // Authed but missing display name → only /onboarding is allowed.
  if (needsDisplayName) {
    return path === ONBOARDING_ROUTE ? null : ONBOARDING_ROUTE;
  }

  // Authed, has display name, no team → onboarding, but allow /join/:code.
  if (!hasTeam) {
    if (path === ONBOARDING_ROUTE) return null;
    if (path.startsWith("/join/")) return null;
    return ONBOARDING_ROUTE;
  }

  // Fully onboarded → push off `/` and `/onboarding` to /board.
  // `/join/:code` stays accessible (same-team no-op or Slice 7 switch).
  if (path === "/" || path === ONBOARDING_ROUTE) {
    return BOARD_ROUTE;
  }
  return null;
}

type Props = { children: ReactNode };

export function AuthGate({ children }: Props) {
  const { user, needsDisplayName, hasTeam, isLoading } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  const destination = isLoading
    ? null
    : resolveDestination(
        { hasUser: !!user, needsDisplayName, hasTeam },
        location.pathname,
      );

  useEffect(() => {
    if (destination && destination !== location.pathname) {
      navigate({ to: destination });
    }
  }, [destination, location.pathname, navigate]);

  if (isLoading) {
    return (
      <main className="min-h-svh flex items-center justify-center bg-background">
        <div
          aria-label="Loading"
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        />
      </main>
    );
  }

  if (destination) {
    return null;
  }

  return <>{children}</>;
}
