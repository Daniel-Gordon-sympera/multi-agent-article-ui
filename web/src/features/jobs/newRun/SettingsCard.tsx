/**
 * Card "Settings" — mockup §3.4: "Defaults come from the platform settings · prompt version
 * `2026.10`" with a ghost `[Hide advanced ⌄]` toggle and the 3-column Advanced grid (days,
 * sites, site timeout, max runtime, memory mode, re-analysis).
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "./FormField";
import type { NewRunValues } from "./newRunSchema";

type NumberKey = "days" | "sites" | "site_timeout" | "max_runtime";

const NUMBER_FIELDS: Array<{ key: NumberKey; label: string; helper?: string; min: number }> = [
  { key: "days", label: "Days to look back", min: 1 },
  { key: "sites", label: "Sites per job", min: 1 },
  { key: "site_timeout", label: "Site timeout (s)", helper: "0 = no per-site limit", min: 0 },
  { key: "max_runtime", label: "Max runtime (s)", min: 60 },
];

export function SettingsCard({ promptVersion }: { promptVersion: string | null | undefined }) {
  const form = useFormContext<NewRunValues>();
  const [advanced, setAdvanced] = useState(true);
  const settingsErrors = form.formState.errors.settings;

  return (
    <Card aria-labelledby="new-run-settings-title">
      <CardHeader
        id="new-run-settings-title"
        title="Settings"
        subtitle="Saved with the job; a resume can override site timeout and memory mode"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          Defaults come from the platform settings · prompt version{" "}
          <span className="font-mono text-ink-2">{promptVersion ?? "—"}</span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          aria-controls="new-run-advanced"
        >
          {advanced ? "Hide advanced" : "Show advanced"}
          {advanced ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
      </div>
      {advanced ? (
        <div id="new-run-advanced" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBER_FIELDS.map((field) => (
            <FormField
              key={field.key}
              id={`new-run-${field.key}`}
              label={field.label}
              helper={field.helper}
              error={settingsErrors?.[field.key]?.message}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="number"
                  min={field.min}
                  step={1}
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  {...form.register(`settings.${field.key}`, { valueAsNumber: true })}
                />
              )}
            </FormField>
          ))}
          <FormField id="new-run-memory-mode" label="Memory mode">
            {({ id }) => (
              <Controller
                control={form.control}
                name="settings.memory_mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={id}
                      size="form"
                      aria-label="Memory mode"
                      className="font-mono"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["full", "pages_only", "off"] as const).map((mode) => (
                        <SelectItem key={mode} value={mode} className="font-mono">
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField id="new-run-reanalyze" label="Re-analysis">
            {({ id }) => (
              <Controller
                control={form.control}
                name="settings.reanalyze"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={id} size="form" aria-label="Re-analysis">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reuse">
                        Reuse summaries on matching prompt version
                      </SelectItem>
                      <SelectItem value="reanalyze">
                        Re-analyse every article (reanalyze)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </div>
      ) : null}
    </Card>
  );
}
