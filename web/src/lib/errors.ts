/** Turns any thrown value into operator-facing wording and toasts it (contract §5.2). */
import { isApiError } from "@/api/client";
import { toast } from "@/components/ui/sonner";

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isApiError(error)) return error.userMessage;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function errorTitle(error: unknown, fallback = "Request failed"): string {
  if (isApiError(error)) return error.title;
  return fallback;
}

/** `toast.error` with the problem detail; returns the message for callers that also render it. */
export function toastError(error: unknown, title?: string): string {
  const message = errorMessage(error);
  toast.error(title ?? errorTitle(error), { description: title ? message : undefined });
  if (!title) return message;
  return message;
}
