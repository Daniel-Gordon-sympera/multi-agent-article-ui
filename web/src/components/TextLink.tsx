/** Text link — mockup §2.5: 13 px / 500 brand-600 with an optional trailing chevron ("All jobs ›"). */
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TextLinkProps extends ComponentProps<"a"> {
  /** Render onto a router `<Link>` child. */
  asChild?: boolean;
  chevron?: boolean;
  children: ReactNode;
}

export function TextLink({
  asChild,
  chevron = false,
  className,
  children,
  ...props
}: TextLinkProps) {
  const Component = asChild ? Slot : "a";
  return (
    <Component
      className={cn(
        "inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 hover:underline",
        className,
      )}
      {...props}
    >
      {children}
      {chevron ? <ChevronRight size={13} strokeWidth={2.25} aria-hidden /> : null}
    </Component>
  );
}
