/** Field values and client-side validation of the Add / Edit / Promote source dialog. */
import { normaliseStateCode } from "./usStates";

export interface SourceFormValues {
  name: string;
  url: string;
  county: string;
  state_code: string;
  industries: string[];
}

export type SourceFormErrors = Partial<Record<keyof SourceFormValues, string>>;

export function validateSourceForm(values: SourceFormValues): SourceFormErrors {
  const errors: SourceFormErrors = {};
  if (!values.name.trim()) errors.name = "Give the source a name.";
  const url = values.url.trim();
  if (!url) errors.url = "Enter the site URL.";
  else {
    try {
      const parsed = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes("."))
        errors.url = "Enter an http(s) URL with a host name.";
    } catch {
      errors.url = "Enter an http(s) URL with a host name.";
    }
  }
  if (!values.county.trim()) errors.county = "Enter the county.";
  if (!normaliseStateCode(values.state_code)) errors.state_code = "Pick a state.";
  return errors;
}
