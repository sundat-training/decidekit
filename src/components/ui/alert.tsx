import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      tone: {
        info: "border-border bg-muted/50 text-foreground",
        success: "border-success/25 bg-success/8 text-foreground",
        warning: "border-warning/30 bg-warning/10 text-foreground",
        destructive: "border-destructive/30 bg-destructive/8 text-foreground",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

/**
 * `<output>` carries the implicit `status` role, so assistive technology
 * announces these messages politely without an explicit `role` attribute.
 */
function Alert({
  className,
  tone,
  ...props
}: React.ComponentProps<"output"> & VariantProps<typeof alertVariants>) {
  return <output data-slot="alert" className={cn(alertVariants({ tone }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="alert-title" className={cn("block font-medium", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="alert-description"
      className={cn("block text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
