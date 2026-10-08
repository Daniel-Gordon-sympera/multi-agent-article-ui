/**
 * New run / Scout — mockup §3.4: breadcrumbs `Jobs › New run`, header, two columns (Target,
 * Sources, Settings cards | sticky Summary). Pre-fills from `?scout=` (edit / run a Scout),
 * `?from=` (re-run a job) or `?mode=seeds&source=` (one ticked Data Source).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { ErrorState } from "@/components/ErrorState";
import { Breadcrumbs, PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import type { NewRunSearch } from "@/features/jobs/searchSchemas";
import { BatchResultDialog } from "./BatchResultDialog";
import {
  initialValuesFor,
  newRunSchema,
  resolvedKind,
  toBatchInput,
  toScoutInput,
  type NewRunValues,
} from "./newRunSchema";
import { SettingsCard } from "./SettingsCard";
import { SourcesCard } from "./SourcesCard";
import { SummaryCard } from "./SummaryCard";
import { TargetCard } from "./TargetCard";
import {
  useCostEstimate,
  useCountySources,
  useJobForRerun,
  useLatestPromptVersion,
  useScoutForEdit,
  useSourceForSeeds,
} from "./useNewRunData";
import { useNewRunSubmit } from "./useNewRunSubmit";

const crumbs = (last: string) => [
  <Link key="jobs" to="/jobs">
    Jobs
  </Link>,
  last,
];

export function NewRunPage({ search }: { search: NewRunSearch }) {
  const scout = useScoutForEdit(search.scout);
  const job = useJobForRerun(search.from);
  const source = useSourceForSeeds(search.source);
  const loading =
    (search.scout && scout.isPending) ||
    (search.from && job.isPending) ||
    (search.source && source.isPending);
  const initial = useMemo(
    () => initialValuesFor(search, scout.data, job.data, source.data),
    [job.data, scout.data, search, source.data],
  );

  if (search.scout && scout.isError) {
    return (
      <>
        <Breadcrumbs crumbs={crumbs("Scout")} />
        <ErrorState
          error={scout.error}
          title="This Scout could not be loaded"
          onRetry={() => void scout.refetch()}
          retrying={scout.isFetching}
        />
      </>
    );
  }

  const editing = Boolean(search.scout && scout.data && !search.duplicate);
  const title = editing && scout.data ? `Scout · ${scout.data.name}` : "New run";
  return (
    <>
      <PageHeader
        crumbs={crumbs(editing ? "Scout" : "New run")}
        title={title}
        subtitle={
          editing
            ? "Edit the saved setup, run it as it is saved, or save your changes for the next run"
            : "Launch one job per industry, or save the setup as a Scout to run again later"
        }
      />
      {search.from && job.isError ? (
        <ErrorState
          variant="banner"
          error={job.error}
          title="The job to re-run could not be loaded"
          description="The form starts empty instead."
        />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <span className="sr-only">Loading the setup…</span>
        </div>
      ) : (
        <NewRunForm
          key={`${search.scout ?? ""}|${search.duplicate ?? ""}|${search.from ?? ""}|${search.source ?? ""}|${search.mode ?? ""}`}
          initial={initial}
          scoutId={editing && scout.data ? scout.data.id : undefined}
        />
      )}
    </>
  );
}

function NewRunForm({ initial, scoutId }: { initial: NewRunValues; scoutId?: string }) {
  const form = useForm<NewRunValues>({
    resolver: zodResolver(newRunSchema),
    defaultValues: initial,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [county, stateCode, mode, sourceMode, industries, sites, days] = useWatch({
    control: form.control,
    name: [
      "county",
      "state_code",
      "mode",
      "source_mode",
      "industries",
      "settings.sites",
      "settings.days",
    ],
  });
  const county_sources = useCountySources(county, stateCode);
  const promptVersion = useLatestPromptVersion();
  const kind = resolvedKind({ mode, source_mode: sourceMode });
  const estimate = useCostEstimate(
    kind,
    Number.isFinite(sites) ? sites : 5,
    industries.length === 1 ? industries[0] : undefined,
    Number.isFinite(days) ? days : 30,
  );
  const submit = useNewRunSubmit();

  const onCreate = form.handleSubmit((values) =>
    submit.create.mutate(toBatchInput(values, county_sources.sources)),
  );
  const onSaveScout = form.handleSubmit((values) => {
    if (scoutId) submit.save.mutate({ scoutId, input: toScoutInput(values) });
  });
  const onSaveScoutOnly = form.handleSubmit((values) =>
    submit.createOnly.mutate(toScoutInput(values)),
  );

  return (
    <FormProvider {...form}>
      <form
        className="flex flex-wrap items-start gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!scoutId) void onCreate();
        }}
      >
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <TargetCard sources={county_sources.sources} sourcesLoading={county_sources.isLoading} />
          {mode === "location_industry" ? (
            <SourcesCard sources={county_sources.sources} loading={county_sources.isLoading} />
          ) : null}
          <SettingsCard promptVersion={promptVersion.data} />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col lg:max-w-[380px]">
          <SummaryCard
            sources={county_sources.sources}
            promptVersion={promptVersion.data}
            estimate={estimate.data}
            estimateLoading={estimate.isPending}
            scoutId={scoutId}
            dirty={form.formState.isDirty}
            pending={submit.pending}
            onRunScout={() => {
              if (scoutId) submit.run.mutate(scoutId);
            }}
            onSaveScout={() => void onSaveScout()}
            onSaveScoutOnly={() => void onSaveScoutOnly()}
          />
        </div>
      </form>
      <BatchResultDialog
        batch={submit.result}
        onClose={submit.closeResult}
        onRetryLeg={(leg) => submit.retryLeg.mutate(leg)}
        retryingPosition={submit.retryingPosition}
      />
    </FormProvider>
  );
}
