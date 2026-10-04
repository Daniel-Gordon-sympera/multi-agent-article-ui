/**
 * Test rendering helpers (contract §5.6): `renderWithProviders` wraps a component with Query +
 * a memory-history router + Session + Theme + Tooltip; `renderApp` mounts the real route tree
 * at a given URL against the MSW handlers. Sign a mock user in first with `signInMockUser`.
 */
import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type AnyRouter,
} from "@tanstack/react-router";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { SessionProvider } from "@/app/providers/SessionProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { createAppRouter } from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryProvider client={client} devtools={false}>
      <SessionProvider>
        <ThemeProvider>
          <TooltipProvider delayDuration={0}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryProvider>
  );
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /** Initial URL of the memory history (defaults to `/`). */
  route?: string;
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
  router: AnyRouter;
}

/**
 * Renders `ui` inside the providers and a memory router so `<Link>` and `useNavigate` work.
 * Every path renders the element; resolves once the router has loaded the initial location.
 */
export async function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): Promise<RenderWithProvidersResult> {
  const { route = "/", queryClient = createTestQueryClient(), ...renderOptions } = options;
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const splatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => ui,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, splatRoute]),
    history: createMemoryHistory({ initialEntries: [route] }),
  });
  await router.load();
  const result = render(
    <Providers client={queryClient}>
      <RouterProvider router={router as AnyRouter} />
    </Providers>,
    renderOptions,
  );
  return { ...result, queryClient, router: router as AnyRouter };
}

export interface RenderAppOptions {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

/** Mounts the real application route tree at the given URL(s), after the first load settled. */
export async function renderApp(
  options: RenderAppOptions = {},
): Promise<RenderWithProvidersResult> {
  const { initialEntries = ["/"], queryClient = createTestQueryClient() } = options;
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries }));
  await router.load();
  const result = render(
    <Providers client={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, queryClient, router: router as AnyRouter };
}
