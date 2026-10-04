/** Domain link over the site name, used by the finder tables. */
export function DomainCell({ name, url, domain }: { name: string; url: string; domain: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate font-semibold text-ink hover:text-brand-700"
      >
        {domain}
      </a>
      {name && name !== domain ? (
        <span className="truncate text-[12px] text-muted">{name}</span>
      ) : null}
    </div>
  );
}
