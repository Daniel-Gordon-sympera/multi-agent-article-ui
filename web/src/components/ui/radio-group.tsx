/** Radio group with the brand accent; `RadioCard` is the mockup's bordered option (§3.4 Sources). */
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function RadioGroup({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2.5", className)} {...props} />;
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-border-strong bg-surface text-brand-600 outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand-600",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="block size-2 rounded-full bg-brand-600" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export interface RadioCardProps extends Omit<
  ComponentProps<typeof RadioGroupPrimitive.Item>,
  "title"
> {
  title: ReactNode;
  description?: ReactNode;
  checked?: boolean;
}

/** A whole-card radio option: brand-400 border + brand-50 fill when selected. */
export function RadioCard({
  title,
  description,
  checked,
  className,
  id,
  ...props
}: RadioCardProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3 rounded-banner border bg-surface p-3.5 text-left",
        checked ? "border-brand-400 bg-brand-50" : "border-border-strong",
        className,
      )}
    >
      <RadioGroupItem id={id} className="mt-0.5" {...props} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        {description ? <span className="text-[13px] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
