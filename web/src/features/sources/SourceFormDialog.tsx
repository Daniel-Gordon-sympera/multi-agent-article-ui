/**
 * Add / Edit / Promote dialog of Data Sources (mockup §3.10, dialogs undrawn → plan §6.4):
 * name, URL, county, state (select), industries token input. Promote pre-fills from a finder
 * suggestion and keeps its tier/reason as the source's `finder` facts. Mount it fresh per
 * target (the page keys it) so the fields start from that record.
 */
import { useId, useState } from "react";
import type { Source, SourceInput, Suggestion } from "@/api/types/bff";
import { Button } from "@/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IndustryTokenInput } from "./IndustryTokenInput";
import { validateSourceForm, type SourceFormValues } from "./sourceFormValidation";
import { tierLabel } from "./sourcePresentation";
import { useSourceMutations } from "./useSourceMutations";
import { US_STATES, normaliseStateCode } from "./usStates";

export type SourceFormMode =
  | { mode: "add"; defaults?: Partial<SourceInput> }
  | { mode: "edit"; source: Source }
  | { mode: "promote"; suggestion: Suggestion };

export interface SourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SourceFormMode;
}

function initialValues(form: SourceFormMode): SourceFormValues {
  if (form.mode === "edit") {
    const { name, url, county, state_code, industries } = form.source;
    return { name, url, county, state_code, industries: [...industries] };
  }
  if (form.mode === "promote") {
    const s = form.suggestion;
    return {
      name: s.name ?? s.domain,
      url: s.url,
      county: s.county,
      state_code: s.state_code,
      industries: s.industry ? [s.industry] : [],
    };
  }
  return {
    name: form.defaults?.name ?? "",
    url: form.defaults?.url ?? "",
    county: form.defaults?.county ?? "",
    state_code: form.defaults?.state_code ?? "",
    industries: form.defaults?.industries ?? [],
  };
}

const TITLES = { add: "Add source", edit: "Edit source", promote: "Add to sources" } as const;

export function SourceFormDialog({ open, onOpenChange, form }: SourceFormDialogProps) {
  const { create, update, promote } = useSourceMutations();
  const [values, setValues] = useState<SourceFormValues>(() => initialValues(form));
  const [errors, setErrors] = useState<Partial<Record<keyof SourceFormValues, string>>>({});
  const baseId = useId();
  const pending = create.isPending || update.isPending || promote.isPending;

  const set = <K extends keyof SourceFormValues>(key: K, value: SourceFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const found = validateSourceForm(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    const input: SourceInput = {
      name: values.name.trim(),
      url: values.url.trim(),
      county: values.county.trim(),
      state_code: normaliseStateCode(values.state_code) ?? values.state_code,
      industries: values.industries,
    };
    try {
      if (form.mode === "edit") await update.mutateAsync({ id: form.source.id, input });
      else if (form.mode === "promote")
        await promote.mutateAsync({
          suggestion: {
            ...form.suggestion,
            url: input.url,
            county: input.county,
            state_code: input.state_code,
          },
          name: input.name,
          industries: input.industries,
        });
      else await create.mutateAsync(input);
      onOpenChange(false);
    } catch {
      // the mutation toasts the problem; keep the dialog open for corrections
    }
  };

  const field = (key: keyof SourceFormValues) => `${baseId}-${key}`;
  const suggestion = form.mode === "promote" ? form.suggestion : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{TITLES[form.mode]}</DialogTitle>
          <DialogDescription>
            {form.mode === "promote"
              ? "The finder kept this site; adding it makes it a seed for this county."
              : "A curated news site used as a seed for this county and state."}
          </DialogDescription>
        </DialogHeader>
        {suggestion ? (
          <p className="rounded-banner bg-brand-50 px-3.5 py-2.5 text-[12px] text-ink-2">
            {tierLabel(suggestion.tier) ? (
              <span className="font-semibold text-brand-700">{tierLabel(suggestion.tier)} · </span>
            ) : null}
            {suggestion.reason}
          </p>
        ) : null}
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field("name")}>Name</Label>
            <Input
              id={field("name")}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              invalid={!!errors.name}
              aria-describedby={errors.name ? `${field("name")}-error` : undefined}
            />
            {errors.name ? <FieldError id={`${field("name")}-error`} text={errors.name} /> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field("url")}>URL</Label>
            <Input
              id={field("url")}
              type="url"
              inputMode="url"
              placeholder="https://orlandomagazine.com"
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
              invalid={!!errors.url}
              aria-describedby={errors.url ? `${field("url")}-error` : undefined}
            />
            {errors.url ? <FieldError id={`${field("url")}-error`} text={errors.url} /> : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field("county")}>County</Label>
              <Input
                id={field("county")}
                placeholder="Orange"
                value={values.county}
                onChange={(e) => set("county", e.target.value)}
                invalid={!!errors.county}
                aria-describedby={errors.county ? `${field("county")}-error` : undefined}
              />
              {errors.county ? (
                <FieldError id={`${field("county")}-error`} text={errors.county} />
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field("state_code")}>State</Label>
              <Select
                value={normaliseStateCode(values.state_code) ?? ""}
                onValueChange={(code) => set("state_code", code)}
              >
                <SelectTrigger id={field("state_code")} size="form" aria-label="State">
                  <SelectValue placeholder="Pick a state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state_code ? (
                <FieldError id={`${field("state_code")}-error`} text={errors.state_code} />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field("industries")}>Industries</Label>
            <IndustryTokenInput
              id={field("industries")}
              value={values.industries}
              onChange={(industries) => set("industries", industries)}
            />
            <p className="text-[12px] text-muted">
              Pick from the NAICS industry catalog. Seed runs for these industries use this site;
              leave it empty to match every industry.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={pending}>
              {form.mode === "edit" ? "Save changes" : TITLES[form.mode]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} role="alert" className="text-[12px] text-status-fail-fg">
      {text}
    </p>
  );
}
