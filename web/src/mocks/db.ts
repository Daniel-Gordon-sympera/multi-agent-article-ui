/**
 * In-memory mock state shared by the browser worker and the Vitest server. Handlers mutate it
 * (cancel → cancelling, retry → queued, …) and `resetMockDatabase()` restores the fixtures.
 * The signed-in session is mirrored to `sessionStorage` in the browser so a reload keeps it.
 */
import type { Prefs, Source, View } from "@/api/types/bff";
import { DEFAULT_PREFS } from "@/api/types/bff";
import type { JobDetail } from "@/api/types/jobs";
import type { ArticleRow } from "@/api/types/articles";
import type { FlagRow } from "@/api/types/companies";
import type { PipelineEvent } from "@/api/types/events";
import type { FinderSourceRow, RankingRow } from "@/api/types/finder";
import type { SectionRow } from "@/api/types/sections";
import type { CompanyMentionRow, SignalRow } from "@/api/types/signals";
import type { SummaryRow } from "@/api/types/summaries";
import type { SiteRun } from "@/api/types/siteRuns";
import type { DailyStats } from "@/api/types/stats";
import type { Task } from "@/api/types/tasks";
import type { Worker } from "@/api/types/workers";
import type { ScoutWithRuns, Suggestion } from "@/api/types/bff";
import { buildJobFixtures } from "./fixtures/jobs";
import {
  buildArticles,
  buildCompanyMentions,
  buildEvents,
  buildFinderSources,
  buildFlags,
  buildRanking,
  buildSections,
  buildSummaries,
} from "./fixtures/results";
import { buildBatchFixtures, buildScoutFixtures, type MockBatch } from "./fixtures/scouts";
import { buildSignalFixtures } from "./fixtures/signals";
import { buildSiteRunFixtures } from "./fixtures/siteRuns";
import { buildSourceFixtures, buildSuggestionFixtures } from "./fixtures/sources";
import { buildTaskFixtures } from "./fixtures/tasks";
import { MOCK_USERS, type MockUser } from "./fixtures/users";
import { buildDailyStatsFixtures, buildWorkerFixtures } from "./fixtures/workers";

export interface MockSession {
  token: string;
  userId: string;
  csrfToken: string;
}

/** Result rows of the main job, derived from the signal/site-run/task fixtures. */
export interface MockResults {
  articles: ArticleRow[];
  summaries: SummaryRow[];
  mentions: CompanyMentionRow[];
  flags: FlagRow[];
  sections: SectionRow[];
  finderSources: FinderSourceRow[];
  ranking: RankingRow[];
  events: PipelineEvent[];
}

export interface MockDatabase {
  users: MockUser[];
  session: MockSession | null;
  prefs: Map<string, Prefs>;
  jobs: JobDetail[];
  siteRuns: SiteRun[];
  tasks: Task[];
  signals: SignalRow[];
  results: MockResults;
  workers: Worker[];
  dailyStats: DailyStats[];
  scouts: ScoutWithRuns[];
  /** Batches behind the Scouts' runs and the ones `POST /app/batches` creates. */
  batches: MockBatch[];
  sources: Source[];
  suggestions: Suggestion[];
  dismissed: Set<string>;
  views: View[];
  apiKeys: Array<{ id: number; name: string; role: "operator" | "reader"; created_at: string }>;
  loginFailures: Map<string, number>;
  nextId: number;
}

const SESSION_STORAGE_KEY = "scout.mock.session";

function readPersistedSession(): MockSession | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

function persistSession(session: MockSession | null): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    if (session) window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function buildResults(signals: SignalRow[], siteRuns: SiteRun[], tasks: Task[]): MockResults {
  const articles = buildArticles(signals, siteRuns);
  const summaries = buildSummaries(articles, signals);
  const mentions = buildCompanyMentions(signals, summaries);
  return {
    articles,
    summaries,
    mentions,
    flags: buildFlags(mentions),
    sections: buildSections(siteRuns),
    finderSources: buildFinderSources(),
    ranking: buildRanking(),
    events: buildEvents(tasks, siteRuns),
  };
}

function buildDatabase(): MockDatabase {
  const siteRuns = buildSiteRunFixtures();
  const tasks = buildTaskFixtures();
  const signals = buildSignalFixtures();
  const scouts = buildScoutFixtures();
  return {
    users: MOCK_USERS.map((u) => ({ ...u })),
    session: readPersistedSession(),
    prefs: new Map(),
    jobs: buildJobFixtures(),
    siteRuns,
    tasks,
    signals,
    results: buildResults(signals, siteRuns, tasks),
    workers: buildWorkerFixtures(),
    dailyStats: buildDailyStatsFixtures(),
    scouts,
    batches: buildBatchFixtures(scouts),
    sources: buildSourceFixtures(),
    suggestions: buildSuggestionFixtures(),
    dismissed: new Set(),
    views: [
      {
        id: "view-0001",
        user_id: "u-0001-admin",
        name: "Florida construction",
        route: "/signals",
        search: { state: "FL", job_industry: "Construction" },
        columns: null,
        shared: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "view-0002",
        user_id: "u-0001-admin",
        name: "High materiality this week",
        route: "/signals",
        search: { materiality: "High" },
        columns: null,
        shared: false,
        created_at: new Date().toISOString(),
      },
    ],
    apiKeys: [
      { id: 1, name: "ops-cli", role: "operator", created_at: new Date().toISOString() },
      { id: 2, name: "dashboard-reader", role: "reader", created_at: new Date().toISOString() },
    ],
    loginFailures: new Map(),
    nextId: 1000,
  };
}

export const db: MockDatabase = buildDatabase();

export function resetMockDatabase(): void {
  const fresh = buildDatabase();
  fresh.session = null;
  persistSession(null);
  Object.assign(db, fresh);
}

export function setMockSession(session: MockSession | null): void {
  db.session = session;
  persistSession(session);
}

export function nextMockId(prefix = ""): string {
  db.nextId += 1;
  return prefix ? `${prefix}-${db.nextId}` : String(db.nextId);
}

/** Adds a job the mock BFF created (batch fan-out) so the Runs list and `/v1/jobs/:id` see it. */
export function addMockJob(job: JobDetail): void {
  db.jobs.unshift(job);
}

export function userPrefs(userId: string): Prefs {
  return db.prefs.get(userId) ?? { ...DEFAULT_PREFS };
}

/** Test helper: sign a user in without going through the login handler. */
export function signInMockUser(email: string): MockSession {
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No mock user ${email}`);
  const session: MockSession = {
    token: `tok-${user.id}`,
    userId: user.id,
    csrfToken: `csrf-${user.id}`,
  };
  setMockSession(session);
  return session;
}
