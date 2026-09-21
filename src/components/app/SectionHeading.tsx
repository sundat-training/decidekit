import type * as React from "react";

import { cn } from "@/lib/utils";

const TITLE_CLASS = "font-display text-2xl leading-tight tracking-tight sm:text-3xl";

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
  /**
   * Sits at the right edge of the `index / label` line. Giving that line the
   * full width lets a section control sit above the title instead of beside it.
   */
  eyebrowAction?: React.ReactNode;
  /**
   * Takes the title out of the layout while keeping it in the document outline,
   * for a section whose details are collapsed.
   */
  titleHidden?: boolean;
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
  eyebrowAction,
  titleHidden = false,
}: SectionHeadingProps) {
  const Heading: "h1" | "h2" = level === 1 ? "h1" : "h2";

  const eyebrow = (
    <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
      {index} / {label}
    </p>
  );

  const heading = (
    <Heading id={id} className={titleHidden ? "sr-only" : TITLE_CLASS}>
      {title}
    </Heading>
  );

  // Without a description or actions there is nothing left to lay out, so the
  // heading is rendered on its own and only assistive technology sees it.
  const showTitleRow = !titleHidden || Boolean(description) || Boolean(actions);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {eyebrowAction ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {eyebrow}
          <div className="ml-auto flex flex-wrap items-center gap-3">{eyebrowAction}</div>
        </div>
      ) : null}

      {showTitleRow ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="flex flex-col gap-1.5">
            {eyebrowAction ? null : eyebrow}
            {heading}
            {description ? (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-end gap-2">{actions}</div>
          ) : null}
        </div>
      ) : (
        heading
      )}
    </div>
  );
}
