import type * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  /** Two-digit section number, e.g. `01`. */
  index: string;
  label: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
  /**
   * Heading level. A page whose first section doubles as the page title passes
   * `1`; everything else keeps `2` so the outline stays flat.
   */
  level?: 1 | 2;
}

export function SectionHeading({
  index,
  label,
  title,
  description,
  actions,
  id,
  className,
  level = 2,
}: SectionHeadingProps) {
  const Heading: "h1" | "h2" = level === 1 ? "h1" : "h2";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {index} / {label}
        </p>
        <Heading id={id} className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
          {title}
        </Heading>
        {description ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-end gap-2">{actions}</div> : null}
    </div>
  );
}
