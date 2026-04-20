import { Navigate } from "@tanstack/react-router";

import { AuthForm } from "@/features/auth";
import { useCurrentUser } from "@/shared/model/use-current-user";

export function SignInPage() {
  const { user, hasTeam } = useCurrentUser();

  if (user && hasTeam) {
    return <Navigate to="/board" />;
  }
  if (user) {
    return <Navigate to="/onboarding" />;
  }

  return <AuthForm />;
}
