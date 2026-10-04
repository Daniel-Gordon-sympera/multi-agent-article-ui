/** sonner Toaster bound to the theme tokens; mounted once in App. */
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      offset={20}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-banner !border !border-border !bg-surface !text-ink !shadow-popover !text-[13px] !font-sans",
          title: "!font-semibold",
          description: "!text-muted",
          actionButton: "!bg-brand-300 !text-ink !rounded-control !font-semibold",
          cancelButton: "!bg-surface-2 !text-ink-2 !rounded-control",
          closeButton: "!border-border !bg-surface !text-ink-2",
          success: "[&_[data-icon]]:!text-status-done-fg",
          error: "[&_[data-icon]]:!text-status-fail-fg",
          warning: "[&_[data-icon]]:!text-status-warn-fg",
          info: "[&_[data-icon]]:!text-status-running-fg",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
