/** Operator-facing wording for sign-in failures (never reveals whether an account exists). */
import { isApiError } from "@/api/client";
import { errorMessage } from "@/lib/errors";

export function describeSignInError(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) return "Incorrect e-mail or password.";
    if (error.status === 429) return "Too many attempts. Wait a few minutes before trying again.";
    if (error.status === 0 || error.status >= 500)
      return "The console is not reachable right now. Try again in a moment.";
  }
  return errorMessage(error, "Sign-in failed.");
}
