/** Subscribes to a CSS media query through `useSyncExternalStore`; false without `matchMedia`. */
import { useSyncExternalStore } from "react";

function canMatch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatch()) return () => undefined;
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => (canMatch() ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** The mockup's breakpoint: the sidebar collapses to a top bar below 800 px. */
export const NARROW_LAYOUT_QUERY = "(max-width: 799px)";
