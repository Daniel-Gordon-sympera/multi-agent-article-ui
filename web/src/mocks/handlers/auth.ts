/** `/app/auth/*`, `/app/prefs`, `/app/capabilities`, `/app/users*` (contract §4.2–§4.3). */
import { http, HttpResponse } from "msw";
import type {
  ChangePasswordInput,
  CreateUserInput,
  LoginInput,
  Me,
  Prefs,
  UpdateUserInput,
  User,
} from "@/api/types/bff";
import { db, nextMockId, setMockSession, userPrefs } from "@/mocks/db";
import { NOW } from "@/mocks/fixtures/clock";
import { MOCK_CAPABILITIES, type MockUser } from "@/mocks/fixtures/users";
import { readJson } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { currentSession, guard } from "@/mocks/lib/session";

export const BFF_VERSION = "0.1.0";
export const PIPELINE_VERSION = "v2.1.0";

function publicUser(user: MockUser): User {
  const { password: _password, ...rest } = user;
  return rest;
}

export function meFor(user: MockUser): Me {
  return {
    user: publicUser(user),
    csrf_token: currentSession()?.csrfToken ?? "",
    capabilities: MOCK_CAPABILITIES,
    api: { ready: true, checked_at: NOW.toISOString() },
    version: { bff: BFF_VERSION, pipeline_api: PIPELINE_VERSION },
  };
}

export const authHandlers = [
  http.post("/app/auth/login", async ({ request }) => {
    if (request.headers.get("x-requested-with") !== "scout") {
      return problem(403, "csrf_failed", "Missing X-Requested-With header");
    }
    const body = await readJson<LoginInput>(request);
    const email = (body?.email ?? "").trim().toLowerCase();
    const failures = db.loginFailures.get(email) ?? 0;
    if (failures >= 10)
      return problem(429, "too_many_attempts", "Too many failed attempts; try again later");
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== body?.password || user.disabled) {
      db.loginFailures.set(email, failures + 1);
      return problem(401, "invalid_credentials", "Incorrect e-mail or password");
    }
    db.loginFailures.delete(email);
    user.last_login_at = new Date().toISOString();
    setMockSession({
      token: `tok-${user.id}-${Date.now()}`,
      userId: user.id,
      csrfToken: `csrf-${nextMockId()}`,
    });
    return HttpResponse.json(meFor(user));
  }),

  http.post("/app/auth/logout", () => {
    setMockSession(null);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/app/auth/me", ({ request }) => {
    const { user, error } = guard(request, { allowPasswordChange: true });
    if (error) return error;
    return HttpResponse.json(meFor(user));
  }),

  http.post("/app/auth/password", async ({ request }) => {
    const { user, error } = guard(request, { allowPasswordChange: true });
    if (error) return error;
    const body = await readJson<ChangePasswordInput>(request);
    if (!body || body.current_password !== user.password) {
      return problem(401, "invalid_credentials", "The current password is not correct");
    }
    if (!body.new_password || body.new_password.length < 12) {
      return problem(422, "validation_error", "The new password needs at least 12 characters");
    }
    user.password = body.new_password;
    user.must_change_password = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/app/capabilities", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json({
      capabilities: MOCK_CAPABILITIES,
      probed_at: NOW.toISOString(),
      pipeline_api_version: PIPELINE_VERSION,
    });
  }),

  http.get("/app/prefs", ({ request }) => {
    const { user, error } = guard(request);
    if (error) return error;
    return HttpResponse.json(userPrefs(user.id));
  }),

  http.put("/app/prefs", async ({ request }) => {
    const { user, error } = guard(request);
    if (error) return error;
    const patch = (await readJson<Partial<Prefs>>(request)) ?? {};
    const next: Prefs = { ...userPrefs(user.id), ...patch };
    db.prefs.set(user.id, next);
    return HttpResponse.json(next);
  }),

  http.get("/app/users", ({ request }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    return HttpResponse.json({ items: db.users.map(publicUser), next_cursor: null });
  }),

  http.post("/app/users", async ({ request }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const body = await readJson<CreateUserInput>(request);
    if (!body?.email || !body.password || !body.role)
      return problem(422, "validation_error", "email, role and password are required");
    if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
      return problem(409, "user_exists", "A user with this e-mail already exists");
    }
    const user: MockUser = {
      id: nextMockId("u"),
      email: body.email,
      name: body.name ?? body.email,
      role: body.role,
      must_change_password: true,
      created_at: new Date().toISOString(),
      password: body.password,
    };
    db.users.push(user);
    return HttpResponse.json(publicUser(user), { status: 201 });
  }),

  http.patch("/app/users/:id", async ({ request, params }) => {
    const { user: actor, error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const target = db.users.find((u) => u.id === params.id);
    if (!target) return notFound("User");
    const body = (await readJson<UpdateUserInput>(request)) ?? {};
    if (
      target.id === actor.id &&
      (body.disabled === true || (body.role && body.role !== "admin"))
    ) {
      return problem(409, "self_protection", "You cannot disable or demote yourself");
    }
    Object.assign(target, body);
    return HttpResponse.json(publicUser(target));
  }),

  http.post("/app/users/:id/password", async ({ request, params }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const target = db.users.find((u) => u.id === params.id);
    if (!target) return notFound("User");
    const body = await readJson<{ new_password: string }>(request);
    if (!body?.new_password) return problem(422, "validation_error", "new_password is required");
    target.password = body.new_password;
    target.must_change_password = true;
    return new HttpResponse(null, { status: 204 });
  }),
];
