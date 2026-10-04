/**
 * Drawer — mockup §3.9: right-anchored panel (480 px, white, border-left, drawer shadow) over
 * a scrim, with header (title + tag + line 2 + close), scrolling body of `DrawerSection`s and a
 * footer (actions left, previous/next right). Built on Radix Dialog for the focus trap, Escape
 * and scrim click. Open state is either controlled (`open`/`onOpenChange`) or URL-bound through
 * `searchKey`: the drawer is open while that search param is present and closing removes it.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

export interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Search-param key whose presence opens the drawer (e.g. `"signal"` for `/signals?signal=…`). */
  searchKey?: string;
  title: ReactNode;
  /** A Tag or pill right of the title. */
  titleAside?: ReactNode;
  /** Second header line: signal type, materiality pill and the location/date text. */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  width?: number;
  ariaLabel?: string;
  closeLabel?: string;
  className?: string;
}

/** Reads/writes the URL-bound open state for `searchKey`. */
export function useDrawerSearchState(searchKey: string | undefined): {
  open: boolean;
  value: string | undefined;
  close: () => void;
} {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const raw = searchKey ? search[searchKey] : undefined;
  const value = raw === undefined || raw === null || raw === "" ? undefined : String(raw);
  return {
    open: value !== undefined,
    value,
    close: () => {
      if (!searchKey) return;
      void navigate({
        to: ".",
        search: (previous: Record<string, unknown>) => ({ ...previous, [searchKey]: undefined }),
        replace: true,
      } as never);
    },
  };
}

export function Drawer({
  open,
  onOpenChange,
  searchKey,
  title,
  titleAside,
  subtitle,
  children,
  footer,
  onPrevious,
  onNext,
  width = 480,
  ariaLabel = "Details",
  closeLabel = "Close details",
  className,
}: DrawerProps) {
  const urlState = useDrawerSearchState(searchKey);
  const isOpen = open ?? urlState.open;
  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    if (!next && searchKey) urlState.close();
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-label={ariaLabel}
          aria-labelledby={undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-full flex-col border-l border-border bg-surface text-ink shadow-drawer outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:duration-200",
            className,
          )}
          style={{ width }}
          data-testid="drawer"
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <DialogPrimitive.Title className="min-w-0 text-[20px] leading-tight font-bold tracking-[-0.01em] text-ink">
                  {title}
                </DialogPrimitive.Title>
                {titleAside}
              </div>
              {subtitle ? (
                <DialogPrimitive.Description asChild>
                  <div className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink">
                    {subtitle}
                  </div>
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {ariaLabel}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="secondary" size="icon-sm" aria-label={closeLabel}>
                <X aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            {children}
          </div>
          {footer || onPrevious || onNext ? (
            <footer className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-6 py-3.5">
              <div className="flex flex-wrap items-center gap-2">{footer}</div>
              {onPrevious || onNext ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label="Previous"
                    onClick={onPrevious}
                    disabled={!onPrevious}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label="Next"
                    onClick={onNext}
                    disabled={!onNext}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              ) : null}
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface DrawerSectionProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}

/** Body section with the 12/700 uppercase muted heading. */
export function DrawerSection({ title, children, className, aside }: DrawerSectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-section-head text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
