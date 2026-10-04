/** The choices of Settings › Preferences (contract §4.3 `Prefs` enum values). */
import type {
  DensityPreference,
  LandingPreference,
  ThemePreference,
  TimeDisplayPreference,
} from "@/api/types/bff";

export interface PreferenceOption<T extends string> {
  value: T;
  title: string;
  description: string;
}

export const THEME_OPTIONS: PreferenceOption<ThemePreference>[] = [
  {
    value: "system",
    title: "System",
    description: "Follows the operating system's light or dark setting.",
  },
  { value: "light", title: "Light", description: "The mockup's lavender-on-white palette." },
  { value: "dark", title: "Dark", description: "Dark surfaces with re-stepped status colours." },
];

export const DENSITY_OPTIONS: PreferenceOption<DensityPreference>[] = [
  { value: "comfortable", title: "Comfortable", description: "48 px table rows, roomy cells." },
  { value: "compact", title: "Compact", description: "36 px rows — more rows per screen." },
];

export const TIME_OPTIONS: PreferenceOption<TimeDisplayPreference>[] = [
  { value: "utc", title: "UTC", description: "Times in UTC with the local time in a tooltip." },
  { value: "local", title: "Local", description: "Your browser's time zone, UTC in the tooltip." },
];

export const LANDING_OPTIONS: PreferenceOption<LandingPreference>[] = [
  { value: "/", title: "Overview", description: "Tiles, active runs and what needs attention." },
  { value: "/jobs", title: "Jobs › Runs", description: "Straight to the runs table." },
  { value: "/signals", title: "Signals", description: "The cross-job signals explorer." },
];
