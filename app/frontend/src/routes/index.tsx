import { createFileRoute, Navigate } from "@tanstack/react-router";

import { AuthForm } from "@/features/auth";
import { useCurrentUser } from "@/shared/model/useCurrentUser";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, hasTeam } = useCurrentUser();

  // AuthGate normally redirects authed+onboarded users away from `/`,
  // but we render a `Navigate` fallback so this component never flashes
  // the sign-in form to a logged-in user mid-effect.
  if (user && hasTeam) {
    return <Navigate to="/board" />;
  }
  if (user) {
    return <Navigate to="/onboarding" />;
  }

  return <AuthForm />;
}
