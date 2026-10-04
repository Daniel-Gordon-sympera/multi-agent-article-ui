/** The TanStack Router instance; the route tree is generated into `routeTree.gen.ts`. */
import type { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { createQueryClient } from "@/app/providers/QueryProvider";
import { routeTree } from "@/routeTree.gen";

export interface RouterContext {
  queryClient: QueryClient;
}

/** `history` lets tests mount the real tree on a memory history. */
export function createAppRouter(
  queryClient: QueryClient = createQueryClient(),
  history?: RouterHistory,
) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
