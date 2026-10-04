/** The label/value rows of the job "Settings" card (mockup §3.5): saved settings + location. */
import type { JobRecord } from "@/api/types/jobs";
import type { KeyValueItem } from "@/components/KeyValueGrid";
import { formatDuration } from "@/lib/format";

const KNOWN = new Set(["days", "sites", "site_timeout", "max_runtime", "memory_mode", "reanalyze"]);

function onOff(value: unknown): string {
  if (value === true) return "on";
  if (value === false || value === undefined || value === null) return "off";
  return String(value);
}

export function settingsItems(job: JobRecord): KeyValueItem[] {
  const s = job.settings ?? {};
  const items: KeyValueItem[] = [
    { label: "Days", value: typeof s.days === "number" ? String(s.days) : "—" },
    { label: "Sites", value: typeof s.sites === "number" ? String(s.sites) : "—" },
    {
      label: "Site timeout",
      value: s.site_timeout ? formatDuration(s.site_timeout) : "none",
    },
    {
      label: "Max runtime",
      value: typeof s.max_runtime === "number" ? formatDuration(s.max_runtime) : "—",
    },
    { label: "Memory", value: s.memory_mode ?? "—", mono: true },
    { label: "Reanalyze", value: onOff(s.reanalyze), mono: true },
    {
      label: "Client ref",
      value: job.client_reference ?? "—",
      mono: Boolean(job.client_reference),
    },
    {
      label: "Location",
      value:
        typeof job.input.location === "string" && job.input.location
          ? job.input.location
          : typeof job.input.url === "string"
            ? job.input.url
            : `${job.county} County, ${job.state_code}`,
    },
  ];
  for (const [key, value] of Object.entries(s)) {
    if (KNOWN.has(key) || value === undefined || value === null) continue;
    items.push({
      label: key.replace(/_/g, " "),
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
      mono: true,
    });
  }
  return items;
}
