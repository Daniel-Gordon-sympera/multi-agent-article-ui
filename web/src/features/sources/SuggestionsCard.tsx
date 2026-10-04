/**
 * "Suggested by the finder" (mockup §3.10): cards with the domain, Tier tag, "County, ST ·
 * Industry", the finder's reason and Add to sources / Dismiss; "See all N" expands the grid;
 * the footnote explains where suggestions come from. Viewers see the cards without actions.
 */
import { Plus } from "lucide-react";
import { useState } from "react";
import type { Suggestion } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonLines } from "@/components/Skeleton";
import { Tag } from "@/components/Tag";
import { isExternalUrl } from "@/lib/url";
import { suggestionLocation, tierLabel } from "./sourcePresentation";
import { useSourceMutations } from "./useSourceMutations";

export const SUGGESTIONS_PREVIEW = 4;

export interface SuggestionsCardProps {
  suggestions: Suggestion[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  canOperate: boolean;
  onPromote: (suggestion: Suggestion) => void;
}

export function SuggestionsCard({
  suggestions,
  isLoading,
  error,
  onRetry,
  canOperate,
  onPromote,
}: SuggestionsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { dismiss } = useSourceMutations();
  const all = suggestions ?? [];
  const shown = expanded ? all : all.slice(0, SUGGESTIONS_PREVIEW);
  const subtitle = isLoading
    ? "Looking at recent finder verdicts…"
    : all.length
      ? `${Math.min(all.length, shown.length)} ${shown.length === 1 ? "site" : "sites"} the finder kept recently that are not in your list`
      : "Nothing new: every site the finder kept recently is already listed or dismissed";

  return (
    <Card aria-labelledby="finder-suggestions-title">
      <CardHeader
        id="finder-suggestions-title"
        title="Suggested by the finder"
        subtitle={subtitle}
        aside={
          all.length > SUGGESTIONS_PREVIEW ? (
            <Button variant="link" size="sm" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "Show fewer" : `See all ${all.length}`}
            </Button>
          ) : null
        }
      />
      {isLoading ? <SkeletonLines lines={3} /> : null}
      {!isLoading && error ? (
        <ErrorState
          variant="plain"
          error={error}
          onRetry={onRetry}
          title="Suggestions unavailable"
        />
      ) : null}
      {!isLoading && !error && shown.length ? (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
          {shown.map((suggestion) => {
            const tier = tierLabel(suggestion.tier);
            const key = `${suggestion.domain}|${suggestion.county}|${suggestion.state_code}`;
            const dismissing =
              dismiss.isPending &&
              dismiss.variables?.domain === suggestion.domain &&
              dismiss.variables?.county === suggestion.county;
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-banner border border-border bg-surface-2 px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={suggestion.url}
                    target={isExternalUrl(suggestion.url) ? "_blank" : undefined}
                    rel="noreferrer noopener"
                    className="truncate text-[13px] font-semibold text-ink hover:underline"
                  >
                    {suggestion.domain}
                  </a>
                  {tier ? <Tag tone="white">{tier}</Tag> : null}
                </div>
                <p className="text-[12px] text-muted">{suggestionLocation(suggestion)}</p>
                <p className="text-[12px] text-ink-2">{suggestion.reason}</p>
                {canOperate ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Button
                      variant="tonal"
                      size="xs"
                      onClick={() => onPromote(suggestion)}
                      aria-label={`Add ${suggestion.domain} to sources`}
                    >
                      <Plus aria-hidden />
                      Add to sources
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      loading={dismissing}
                      aria-label={`Dismiss ${suggestion.domain}`}
                      onClick={() =>
                        dismiss.mutate({
                          domain: suggestion.domain,
                          county: suggestion.county,
                          state_code: suggestion.state_code,
                        })
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-[12px] text-muted">
        Suggestions come from finder verdicts and rankings of the last 30 days (the judged-domain
        memory). Adding one copies it here with its tier and reason, so the next seed run can use
        it.
      </p>
    </Card>
  );
}
