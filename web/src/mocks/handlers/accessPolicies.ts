import { http, HttpResponse } from "msw";
import { db } from "@/mocks/db";
import { paginate, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

export const accessPolicyHandlers = [
  http.get("/v1/access-policies", ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, []);
    return rejected ?? HttpResponse.json(paginate(db.accessPolicies, url, (row) => row.host));
  }),
  http.post("/v1/access-policies/:host/reset", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const row = db.accessPolicies.find((policy) => policy.host === params.host);
    if (!row) return notFound("Access policy");
    row.active = false;
    row.bot_blocked = false;
    row.subscription_required = false;
    row.reset_at = new Date().toISOString();
    return HttpResponse.json(row);
  }),
];
