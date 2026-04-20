import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { readMeApiUsersMeGet, signOutApiAuthSignOutPost } from "@/api/generated";
import type { CurrentTeamOut, UserOut } from "@/api/generated";

export const currentUserQueryKey = ["current-user"] as const;

type CurrentUserResult = {
  user: UserOut | null;
  current_team: CurrentTeamOut | null;
};

/**
 * The response interceptor in `api/client.ts` throws on any non-2xx, so a
 * 401 (no session) surfaces as a thrown Error here. We treat any thrown
 * error from `readMeApiUsersMeGet` as "no user" rather than trying to parse
 * the JSON-stringified payload — simpler and the endpoint only meaningfully
 * fails with 401 in normal flow.
 */
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

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await signOutApiAuthSignOutPost();
      } catch {
        // Swallow — cookie may already be cleared; we still drop cached user.
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
}
