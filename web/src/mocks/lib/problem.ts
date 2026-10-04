/** Problem+json responses in the backend's shape (contract §1). */
import { HttpResponse } from "msw";

export function problem(
  status: number,
  category: string,
  detail: string,
  extra: Record<string, unknown> = {},
) {
  return HttpResponse.json(
    {
      type: `urn:sympera:problem:${category}`,
      title: category.replace(/_/g, " "),
      status,
      detail,
      instance: "",
      error_category: category,
      ...extra,
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

export const notFound = (what: string) => problem(404, "not_found", `${what} was not found`);
export const forbidden = (detail = "Your role may not perform this action") =>
  problem(403, "forbidden", detail);
export const notAuthenticated = () => problem(401, "not_authenticated", "Sign in to continue");
