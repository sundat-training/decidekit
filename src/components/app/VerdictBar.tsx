export interface VerdictBarProps {
  /** Rendered ratio, e.g. `4.21× generation / direct`. */
  ratio: string;
}

/**
 * Only rendered when both paths ran: it is the one number the lanes do not
 * already show.
 */
export function VerdictBar({ ratio }: VerdictBarProps) {
  return (
    <section
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-foreground px-6 py-5 text-background"
    >
      <span className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-70">
        measured wall-time ratio
      </span>
      <strong
        className="metric-value font-mono text-xl font-medium whitespace-nowrap sm:text-2xl"
        data-testid="ratio"
      >
        {ratio}
      </strong>
    </section>
  );
}
