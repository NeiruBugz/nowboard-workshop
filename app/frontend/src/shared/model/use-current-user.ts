import { useQuery } from "@tanstack/react-query";

import { readMeApiUsersMeGet } from "@/shared/api/generated";
import type { CurrentTeamOut, UserOut } from "@/shared/api/generated";

export const currentUserQueryKey = ["current-user"] as const;

type CurrentUserResult = {
  user: UserOut | null;
  current_team: CurrentTeamOut | null;
};

export function useCurrentUser() {
  const query = useQuery<CurrentUserResult>({
    queryKey: currentUserQueryKey,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      try {
        const { data } = await readMeApiUsersMeGet();
        if (!data) return { user: null, current_team: null };
        return { user: data.user, current_team: data.current_team ?? null };
      } catch {
        return { user: null, current_team: null };
      }
    },
  });

  const user = query.data?.user ?? null;
  const displayName = user?.display_name ?? null;
  const needsDisplayName = !!user && (!displayName || displayName.trim().length === 0);
  const currentTeam = query.data?.current_team ?? null;
  const hasTeam = !!currentTeam;

  return {
    user,
    displayName,
    needsDisplayName,
    currentTeam,
    hasTeam,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
