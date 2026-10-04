/**
 * Button — mockup-spec §2.5. Variants primary / secondary / danger (danger-secondary) /
 * tonal / ghost / link; sizes md 40 · sm 32 · xs 28 and the square icon sizes.
 * `asChild` renders the styles onto a child (`<Link>`); `loading` shows a spinner and disables.
 */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-semibold whitespace-nowrap outline-none select-none",
    "transition-[filter,background-color,color] hover-dim",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-default disabled:border-border disabled:bg-surface disabled:text-faint disabled:shadow-none disabled:hover:filter-none",
    "[&>svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "border-brand-400 bg-brand-300 text-[#1C1A33] shadow-primary",
        secondary: "border-border-strong bg-surface text-ink",
        danger: "border-border-strong bg-surface text-status-fail-fg",
        tonal: "border-brand-200 bg-brand-50 text-brand-700",
        ghost:
          "border-transparent bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink disabled:bg-transparent disabled:border-transparent",
        link: "h-auto border-transparent bg-transparent p-0 font-medium text-brand-600 hover:text-brand-700 hover:underline disabled:bg-transparent disabled:border-transparent",
      },
      size: {
        md: "h-10 px-4 text-[14px] [&>svg]:size-4",
        sm: "h-8 px-3 text-[13px] [&>svg]:size-3.5",
        xs: "h-7 px-2.5 text-[12px] [&>svg]:size-3.5",
        icon: "size-10 p-0 [&>svg]:size-4",
        "icon-sm": "size-8 p-0 [&>svg]:size-4",
        "icon-xs": "size-7 p-0 [&>svg]:size-3.5",
        "icon-2xs": "size-6 p-0 [&>svg]:size-3.5",
      },
    },
    compoundVariants: [
      { variant: "link", size: ["md", "sm", "xs"], class: "h-auto px-0 text-[13px]" },
    ],
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Component>
  );
}
