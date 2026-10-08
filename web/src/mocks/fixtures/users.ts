/** Mock accounts (contract §5.6). Passwords exist only in the mock layer. */
import type { Capabilities, User } from "@/api/types/bff";
import { daysAgo } from "./clock";

export interface MockUser extends User {
  password: string;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: "u-0001-admin",
    email: "admin@sympera.ai",
    name: "daniel-ops",
    role: "admin",
    must_change_password: false,
    created_at: daysAgo(30),
    password: "scout-admin",
  },
  {
    id: "u-0002-operator",
    email: "operator@sympera.ai",
    name: "ops-oncall",
    role: "operator",
    must_change_password: false,
    created_at: daysAgo(20),
    password: "scout-operator",
  },
  {
    id: "u-0003-viewer",
    email: "viewer@sympera.ai",
    name: "rm-viewer",
    role: "viewer",
    must_change_password: false,
    created_at: daysAgo(10),
    password: "scout-viewer",
  },
  {
    id: "u-0004-newcomer",
    email: "newcomer@sympera.ai",
    name: "newcomer",
    role: "operator",
    must_change_password: true,
    created_at: daysAgo(1),
    password: "scout-newcomer",
  },
];

/** Today's backend: none of the optional routes exist. */
export const MOCK_CAPABILITIES: Capabilities = {
  signals_global: true,
  tasks_global: true,
  retry_dead: true,
  api_keys_list: true,
  sources_stats: true,
  cost_estimate: true,
  jobs_industry_filter: true,
  jobs_reference_filter: true,
};
