/**
 * Session state (engineering contract §5.3): loads `GET /app/auth/me` once, exposes the user,
 * role, CSRF token, capabilities and API readiness, `can("operate" | "admin")`, `signIn`,
 * `signOut` and `refresh`. The HTTP client's `401`/`403 password_change_required` signals are
 * wired through `sessionStore`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { getCapabilities, getMe, login, logout } from "@/api/bff";
import { clearEtagCache, isApiError } from "@/api/client";
import { qk } from "@/api/keys";
import { sessionStore } from "@/api/sessionStore";
import type {
  ApiStatus,
  CapabilitiesResponse,
  Capabilities,
  CapabilityName,
  Me,
  Role,
  User,
} from "@/api/types/bff";

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "error";
export type SessionAction = "operate" | "admin";

export interface SessionValue {
  status: SessionStatus;
  me: Me | null;
  user: User | null;
  role: Role | null;
  csrfToken: string | null;
  capabilities: Capabilities | null;
  api: ApiStatus | null;
  contract: CapabilitiesResponse | null;
  error: unknown;
  can: (action: SessionAction) => boolean;
  hasCapability: (name: CapabilityName) => boolean;
  signIn: (email: string, password: string) => Promise<Me>;
  signOut: () => Promise<void>;
  refresh: () => Promise<Me | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

const EMPTY_CAPABILITIES: Capabilities = {
  signals_global: false,
  tasks_global: false,
  retry_dead: false,
  api_keys_list: false,
  sources_stats: false,
  cost_estimate: false,
  jobs_industry_filter: false,
  jobs_reference_filter: false,
};

export function roleCan(role: Role | null | undefined, action: SessionAction): boolean {
  if (!role) return false;
  if (action === "admin") return role === "admin";
  return role === "admin" || role === "operator";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery<Me | null>({
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
    refetchOnWindowFocus: true,
  });

  const me = meQuery.data ?? null;
  const capabilityQuery = useQuery({
    queryKey: qk.app.capabilities(),
    queryFn: getCapabilities,
    enabled: Boolean(me),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const capabilities = capabilityQuery.data?.capabilities ?? me?.capabilities ?? null;
  const capabilitySignature = JSON.stringify(
    capabilityQuery.data
      ? [
          capabilityQuery.data.capabilities,
          capabilityQuery.data.compatible,
          capabilityQuery.data.contract_version,
        ]
      : null,
  );
  const previousCapabilities = useRef(capabilitySignature);
  useEffect(() => {
    if (previousCapabilities.current !== capabilitySignature) {
      previousCapabilities.current = capabilitySignature;
      clearEtagCache();
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "v1" ||
          (query.queryKey[0] === "app" &&
            !["auth", "capabilities"].includes(String(query.queryKey[1]))),
      });
    }
  }, [capabilitySignature, queryClient]);

  useEffect(() => {
    sessionStore.setCsrfToken(me?.csrf_token ?? null);
  }, [me]);

  useEffect(() => {
    const offSignedOut = sessionStore.onSignedOut(() => {
      queryClient.setQueryData<Me | null>(qk.app.me(), null);
      clearEtagCache();
    });
    const offPassword = sessionStore.onPasswordChangeRequired(() => {
      queryClient.setQueryData<Me | null>(qk.app.me(), (current) =>
        current ? { ...current, user: { ...current.user, must_change_password: true } } : current,
      );
    });
    return () => {
      offSignedOut();
      offPassword();
    };
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await login({ email, password });
      sessionStore.setCsrfToken(result.csrf_token);
      queryClient.setQueryData<Me | null>(qk.app.me(), result);
      return result;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // The cookie may already be gone; the local state is cleared either way.
    }
    sessionStore.setCsrfToken(null);
    clearEtagCache();
    queryClient.setQueryData<Me | null>(qk.app.me(), null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "app" || query.queryKey[1] !== "auth",
    });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const result = await meQuery.refetch();
    return result.data ?? null;
  }, [meQuery]);

  const status: SessionStatus = meQuery.isPending
    ? "loading"
    : meQuery.isError
      ? "error"
      : me
        ? "authenticated"
        : "anonymous";

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      user: me?.user ?? null,
      role: me?.user.role ?? null,
      csrfToken: me?.csrf_token ?? null,
      capabilities,
      contract: capabilityQuery.data ?? null,
      api: me?.api ?? null,
      error: meQuery.error,
      can: (action) => roleCan(me?.user.role, action),
      hasCapability: (name) => (capabilities ?? EMPTY_CAPABILITIES)[name] === true,
      signIn,
      signOut,
      refresh,
    }),
    [me, capabilities, capabilityQuery.data, meQuery.error, refresh, signIn, signOut, status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

/** The signed-in user; throws when used outside the authenticated area. */
export function useCurrentUser(): User {
  const { user } = useSession();
  if (!user) throw new Error("useCurrentUser used while signed out");
  return user;
}
