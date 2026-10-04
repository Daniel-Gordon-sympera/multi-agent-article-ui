/**
 * Theme, density and time-display preferences (engineering contract §5.3): `data-theme` and
 * `data-density` on `<html>`; values come from `localStorage` before sign-in and from
 * `GET /app/prefs` after, writes go to both (`PUT /app/prefs` when signed in).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getPrefs, updatePrefs as putPrefs } from "@/api/bff";
import { qk } from "@/api/keys";
import {
  DEFAULT_PREFS,
  type DensityPreference,
  type LandingPreference,
  type Prefs,
  type ThemePreference,
  type TimeDisplayPreference,
} from "@/api/types/bff";
import { useSession } from "@/app/providers/SessionProvider";
import { toastError } from "@/lib/errors";
import { readLocalStorage, writeLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

export const PREFS_STORAGE_KEY = "scout.prefs";

export type ResolvedTheme = "light" | "dark";

export interface ThemeValue {
  prefs: Prefs;
  resolvedTheme: ResolvedTheme;
  timeDisplay: TimeDisplayPreference;
  density: DensityPreference;
  updatePrefs: (patch: Partial<Prefs>) => void;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setDensity: (density: DensityPreference) => void;
  toggleDensity: () => void;
  setTimeDisplay: (value: TimeDisplayPreference) => void;
  setLanding: (value: LandingPreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const THEMES: readonly ThemePreference[] = ["system", "light", "dark"];
const DENSITIES: readonly DensityPreference[] = ["comfortable", "compact"];
const TIME_DISPLAYS: readonly TimeDisplayPreference[] = ["utc", "local"];
const LANDINGS: readonly LandingPreference[] = ["/", "/jobs", "/signals"];

export function isPrefs(value: unknown): value is Prefs {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    THEMES.includes(v.theme as ThemePreference) &&
    DENSITIES.includes(v.density as DensityPreference) &&
    TIME_DISPLAYS.includes(v.time_display as TimeDisplayPreference) &&
    LANDINGS.includes(v.landing as LandingPreference)
  );
}

/** Accepts partial/unknown server answers and fills the defaults. */
export function normalisePrefs(value: unknown): Prefs {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    theme: THEMES.includes(v.theme as ThemePreference)
      ? (v.theme as ThemePreference)
      : DEFAULT_PREFS.theme,
    density: DENSITIES.includes(v.density as DensityPreference)
      ? (v.density as DensityPreference)
      : DEFAULT_PREFS.density,
    time_display: TIME_DISPLAYS.includes(v.time_display as TimeDisplayPreference)
      ? (v.time_display as TimeDisplayPreference)
      : DEFAULT_PREFS.time_display,
    landing: LANDINGS.includes(v.landing as LandingPreference)
      ? (v.landing as LandingPreference)
      : DEFAULT_PREFS.landing,
  };
}

export function applyThemeToDocument(theme: ResolvedTheme, density: DensityPreference): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-density", density);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const signedIn = status === "authenticated";
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const [localPrefs, setLocalPrefs] = useState<Prefs>(() =>
    readLocalStorage(PREFS_STORAGE_KEY, isPrefs, DEFAULT_PREFS),
  );

  const serverPrefs = useQuery({
    queryKey: qk.app.prefs(),
    queryFn: async () => {
      const prefs = normalisePrefs(await getPrefs());
      writeLocalStorage(PREFS_STORAGE_KEY, prefs);
      return prefs;
    },
    enabled: signedIn,
    staleTime: 10 * 60_000,
  });

  const save = useMutation({
    mutationFn: (patch: Partial<Prefs>) => putPrefs(patch),
    onError: (error) => toastError(error, "Preferences were not saved"),
  });

  const prefs = signedIn && serverPrefs.data ? serverPrefs.data : localPrefs;

  const updatePrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const next = normalisePrefs({ ...prefs, ...patch });
      setLocalPrefs(next);
      writeLocalStorage(PREFS_STORAGE_KEY, next);
      if (signedIn) {
        queryClient.setQueryData<Prefs>(qk.app.prefs(), next);
        save.mutate(patch);
      }
    },
    [prefs, queryClient, save, signedIn],
  );

  const resolvedTheme: ResolvedTheme =
    prefs.theme === "system" ? (prefersDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    applyThemeToDocument(resolvedTheme, prefs.density);
  }, [prefs.density, resolvedTheme]);

  const value = useMemo<ThemeValue>(
    () => ({
      prefs,
      resolvedTheme,
      timeDisplay: prefs.time_display,
      density: prefs.density,
      updatePrefs,
      setTheme: (theme) => updatePrefs({ theme }),
      toggleTheme: () => updatePrefs({ theme: resolvedTheme === "dark" ? "light" : "dark" }),
      setDensity: (density) => updatePrefs({ density }),
      toggleDensity: () =>
        updatePrefs({ density: prefs.density === "compact" ? "comfortable" : "compact" }),
      setTimeDisplay: (time_display) => updatePrefs({ time_display }),
      setLanding: (landing) => updatePrefs({ landing }),
    }),
    [prefs, resolvedTheme, updatePrefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

/** The time-display preference for `RelativeTime`/`formatDateTime`; `utc` outside a provider. */
export function useTimeDisplay(): TimeDisplayPreference {
  return useContext(ThemeContext)?.timeDisplay ?? "utc";
}
