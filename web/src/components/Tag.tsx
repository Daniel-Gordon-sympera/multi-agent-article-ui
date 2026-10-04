/** Tag — mockup-spec §5: h22, radius 6, 12/600; tones neutral (surface-2) / brand (brand-100) / white. */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type TagTone = "neutral" | "brand" | "white";

export interface TagProps extends ComponentProps<"span"> {
  tone?: TagTone;
  mono?: boolean;
}

const toneClass: Record<TagTone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-transparent",
  brand: "bg-brand-100 text-brand-700 border-transparent",
  white: "bg-surface text-ink-2 border-border",
};

export function Tag({ tone = "neutral", mono = false, className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center rounded-tag border px-2 text-[12px] leading-none font-semibold whitespace-nowrap",
        toneClass[tone],
        mono && "font-mono font-medium",
        className,
      )}
      {...props}
    />
  );
}
