/** Form label — 13 px / 600 / ink-2 (mockup §3.4). */
import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-[13px] font-semibold text-ink-2 peer-disabled:text-faint", className)}
      {...props}
    />
  );
}
