/** Text link — mockup §2.5: 13 px / 500 brand-600 with an optional trailing chevron ("All jobs ›"). */
import { Slot, Slottable } from "@radix-ui/react-slot";
import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TextLinkProps extends ComponentProps<"a"> {
  /** Render onto a router `<Link>` child. */
  asChild?: boolean;
  chevron?: boolean;
  children: ReactNode;
}

const textLinkClass =
  "inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 hover:underline";

export function TextLink({
  asChild,
  chevron = false,
  className,
  children,
  ...props
}: TextLinkProps) {
  const chevronIcon = chevron ? <ChevronRight size={13} strokeWidth={2.25} aria-hidden /> : null;
  if (asChild) {
    // `Slottable` marks the router `<Link>` as the element that receives the props; the chevron
    // is rendered inside it (Radix needs exactly one slottable child).
    return (
      <Slot className={cn(textLinkClass, className)} {...props}>
        <Slottable>{children}</Slottable>
        {chevronIcon}
      </Slot>
    );
  }
  return (
    <a className={cn(textLinkClass, className)} {...props}>
      {children}
      {chevronIcon}
    </a>
  );
}
