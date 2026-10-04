/** Cells shared by the mention and flag column sets of the Companies tab. */
import { Link } from "@tanstack/react-router";
import { Tag } from "@/components/Tag";

const dash = <span className="text-muted">—</span>;
const text = (value: string | null | undefined) => (value ? value : dash);

export function CompanyCell({
  jobId,
  companyKey,
  name,
  orgKind,
}: {
  jobId: string;
  companyKey: string;
  name: string;
  orgKind: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Link
        to="/signals"
        search={{ job_id: jobId, company_key: companyKey }}
        className="truncate font-semibold text-ink hover:text-brand-700"
        title="Signals of this company"
      >
        {name}
      </Link>
      <Tag>{orgKind || "unknown"}</Tag>
    </div>
  );
}

export function PlaceCell({ place, scope }: { place: string; scope: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="whitespace-nowrap">{place || dash}</span>
      <Tag>{scope || "unknown"}</Tag>
    </div>
  );
}

export function IndustryCell({ industry, sub }: { industry: string; sub: string }) {
  return (
    <div className="flex max-w-[160px] flex-col">
      <span className="truncate">{industry || "unknown"}</span>
      {sub && sub !== "unknown" ? (
        <span className="truncate text-[11px] text-muted">{sub}</span>
      ) : null}
    </div>
  );
}

/** "—" placeholder cell (faint) and a text-or-dash helper for optional strings. */
export function DashCell() {
  return dash;
}

export function TextCell({ value }: { value: string | null | undefined }) {
  return <>{text(value)}</>;
}
