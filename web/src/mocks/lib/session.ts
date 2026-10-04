/** Session, CSRF and role checks shared by the mock handlers (contract §4.2). */
import { db, type MockSession } from "@/mocks/db";
import type { MockUser } from "@/mocks/fixtures/users";
import { forbidden, notAuthenticated, problem } from "./problem";

export function currentUser(): MockUser | null {
  const session = db.session;
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

export function currentSession(): MockSession | null {
  return db.session;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Returns a problem response when the request is not allowed, else the user. `minRole` maps to
 * admin ⊃ operator ⊃ viewer; `allowPasswordChange` lets the password endpoints through while
 * `must_change_password` is set.
 */
export function guard(
  request: Request,
  options: { minRole?: "viewer" | "operator" | "admin"; allowPasswordChange?: boolean } = {},
): { user: MockUser; error: null } | { user: null; error: Response } {
  const user = currentUser();
  if (!user) return { user: null, error: notAuthenticated() };
  if (UNSAFE.has(request.method.toUpperCase())) {
    if (request.headers.get("x-requested-with") !== "scout") {
      return { user: null, error: problem(403, "csrf_failed", "Missing X-Requested-With header") };
    }
    if (request.headers.get("x-csrf-token") !== db.session?.csrfToken) {
      return { user: null, error: problem(403, "csrf_failed", "Missing or stale CSRF token") };
    }
  }
  if (user.must_change_password && !options.allowPasswordChange) {
    return {
      user: null,
      error: problem(403, "password_change_required", "Change your password before continuing"),
    };
  }
  if (options.minRole && !roleAtLeast(user.role, options.minRole)) {
    return { user: null, error: forbidden() };
  }
  return { user, error: null };
}

const RANK = { viewer: 0, operator: 1, admin: 2 } as const;

export function roleAtLeast(role: keyof typeof RANK, min: keyof typeof RANK): boolean {
  return RANK[role] >= RANK[min];
}
