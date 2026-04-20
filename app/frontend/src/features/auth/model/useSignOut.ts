import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signOutApiAuthSignOutPost } from "@/shared/api/generated";
import { currentUserQueryKey } from "@/shared/model/useCurrentUser";

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await signOutApiAuthSignOutPost();
      } catch {
        // Cookie may already be cleared; still drop cached user.
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
}
