/** Only same-origin paths are followed after sign-in (no protocol-relative or absolute URLs). */
export function safeRedirect(target: string | undefined, fallback: string): string {
  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.startsWith("/sign-in")
  ) {
    return fallback;
  }
  return target;
}
