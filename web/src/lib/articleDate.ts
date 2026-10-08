import { formatDate } from "./format";

export function formatArticleDate(
  value: string | null | undefined,
  precision?: string | null,
): string {
  if (!value || precision === "unknown") return "—";
  if (precision === "month" || /^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(date);
  }
  return formatDate(value);
}
