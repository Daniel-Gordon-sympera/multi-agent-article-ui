/**
 * React Query client with the contract's defaults: queries retry once (never on 4xx), no
 * mutation retries, polling pauses in background tabs, devtools in development only.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { isApiError } from "@/api/client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status > 0 && error.status < 500) return false;
          return failureCount < 1;
        },
        retryDelay: 800,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        staleTime: 10_000,
        gcTime: 5 * 60_000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export interface QueryProviderProps {
  children: ReactNode;
  /** Tests pass their own client so each test starts clean. */
  client?: QueryClient;
  devtools?: boolean;
}

export function QueryProvider({
  children,
  client,
  devtools = import.meta.env.DEV,
}: QueryProviderProps) {
  const [ownClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={client ?? ownClient}>
      {children}
      {devtools ? <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" /> : null}
    </QueryClientProvider>
  );
}
