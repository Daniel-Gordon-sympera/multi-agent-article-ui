/** Shared query options for `GET /app/auth/me` (used by SessionProvider and the `_app` gate). */
import { queryOptions } from "@tanstack/react-query";
import { getMe } from "@/api/bff";
import { isApiError } from "@/api/client";
import { qk } from "@/api/keys";
import type { Me } from "@/api/types/bff";

export const meQueryOptions = queryOptions<Me | null>({
  queryKey: qk.app.me(),
  queryFn: async () => {
    try {
      return await getMe();
    } catch (error) {
      if (isApiError(error) && error.status === 401) return null;
      throw error;
    }
  },
  retry: false,
  staleTime: 5 * 60_000,
});
