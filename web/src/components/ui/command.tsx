/** cmdk primitives styled for the ⌘K palette (contract §5.5 CommandPalette). */
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-card bg-surface text-ink",
        className,
      )}
      {...props}
    />
  );
}

export interface CommandDialogProps extends ComponentProps<typeof Dialog> {
  title?: string;
  description?: string;
}

export function CommandDialog({
  children,
  title = "Command palette",
  description = "Search pages, jobs and companies",
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent
        hideClose
        className="top-[18%] max-w-[560px] translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-section-head [&_[cmdk-group-heading]]:text-muted">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-4" cmdk-input-wrapper="">
      <Search size={16} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          "h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[360px] overflow-x-hidden overflow-y-auto p-1.5", className)}
      {...props}
    />
  );
}

export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="py-6 text-center text-[13px] text-muted" {...props} />;
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group className={cn("overflow-hidden py-1 text-ink", className)} {...props} />
  );
}

export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("-mx-1.5 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-[13px] text-ink outline-none select-none data-[selected=true]:bg-brand-100 data-[selected=true]:text-brand-700 data-[disabled=true]:pointer-events-none data-[disabled=true]:text-faint",
        className,
      )}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto rounded-kbd border border-border-strong bg-surface px-1.5 py-px font-mono text-[11px] font-semibold text-muted",
        className,
      )}
      {...props}
    />
  );
}
