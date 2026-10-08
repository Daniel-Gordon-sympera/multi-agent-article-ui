import type { components } from "./pipeline.gen";
import { apiPost, fetchPage } from "./client";
import type { PageParams } from "./types/common";

export type AccessPolicy = components["schemas"]["AccessPolicyRecord"];

export function listAccessPolicies(page: PageParams = {}) {
  return fetchPage<AccessPolicy>("/v1/access-policies", page);
}

export function resetAccessPolicy(host: string): Promise<AccessPolicy> {
  return apiPost(`/v1/access-policies/${encodeURIComponent(host)}/reset`);
}
