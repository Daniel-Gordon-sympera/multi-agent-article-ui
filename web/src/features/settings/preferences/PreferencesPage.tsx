/**
 * Settings › Preferences: theme, density, time display and landing page. Each choice applies
 * immediately through the ThemeProvider (which writes `PUT /app/prefs` and localStorage) and
 * confirms with a toast; the ThemeProvider toasts the error if the save fails.
 */
import type { ReactNode } from "react";
import type { Prefs } from "@/api/types/bff";
import { useTheme } from "@/app/providers/ThemeProvider";
import { Card, CardHeader } from "@/components/Card";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import { SettingsSection } from "../SettingsSection";
import {
  DENSITY_OPTIONS,
  LANDING_OPTIONS,
  THEME_OPTIONS,
  TIME_OPTIONS,
  type PreferenceOption,
} from "./preferenceOptions";

function PreferenceGroup<T extends string>({
  id,
  title,
  description,
  options,
  value,
  onChange,
}: {
  id: string;
  title: string;
  description: ReactNode;
  options: PreferenceOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Card aria-labelledby={`${id}-title`}>
      <CardHeader id={`${id}-title`} title={title} subtitle={description} />
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as T)}
        aria-label={title}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))" }}
      >
        {options.map((option) => (
          <RadioCard
            key={option.value}
            id={`${id}-${option.value.replace(/\W/g, "") || "root"}`}
            value={option.value}
            checked={value === option.value}
            title={option.title}
            description={option.description}
          />
        ))}
      </RadioGroup>
    </Card>
  );
}

export function PreferencesPage() {
  const { prefs, updatePrefs } = useTheme();
  const save = (patch: Partial<Prefs>, label: string) => {
    updatePrefs(patch);
    toast.success("Preferences saved", { description: label });
  };
  return (
    <SettingsSection
      id="settings-preferences"
      title="Preferences"
      description="Per-user display settings, saved to your account and applied on every device you sign in from."
    >
      <PreferenceGroup
        id="pref-theme"
        title="Theme"
        description="Applies immediately."
        options={THEME_OPTIONS}
        value={prefs.theme}
        onChange={(theme) => save({ theme }, `Theme: ${theme}`)}
      />
      <PreferenceGroup
        id="pref-density"
        title="Density"
        description="Row height of every table; the per-table toggle overrides it for one view."
        options={DENSITY_OPTIONS}
        value={prefs.density}
        onChange={(density) => save({ density }, `Density: ${density}`)}
      />
      <PreferenceGroup
        id="pref-time"
        title="Time display"
        description="How timestamps read across the console."
        options={TIME_OPTIONS}
        value={prefs.time_display}
        onChange={(time_display) => save({ time_display }, `Time display: ${time_display}`)}
      />
      <PreferenceGroup
        id="pref-landing"
        title="Landing page"
        description="Where sign-in takes you."
        options={LANDING_OPTIONS}
        value={prefs.landing}
        onChange={(landing) => save({ landing }, `Landing page: ${landing}`)}
      />
    </SettingsSection>
  );
}
