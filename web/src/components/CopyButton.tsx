/** CopyButton — mockup §2.3: 24×24 ghost copy icon, `aria-label="Copy job id"`; toasts on success. */
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/Button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children" | "value"> {
  value: string;
  /** Required accessible name, e.g. "Copy job id". */
  label: string;
  /** Toast text; `null` disables the toast. */
  successMessage?: string | null;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label,
  successMessage = "Copied to clipboard",
  size = "icon-2xs",
  variant = "ghost",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <SimpleTooltip content={copied ? "Copied" : label}>
      <Button
        variant={variant}
        size={size}
        aria-label={label}
        onClick={async () => {
          const ok = await copyToClipboard(value);
          if (ok) {
            setCopied(true);
            if (successMessage) toast.success(successMessage);
          } else {
            toast.error("Could not copy to the clipboard");
          }
        }}
        {...props}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
    </SimpleTooltip>
  );
}
