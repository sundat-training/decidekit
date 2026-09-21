export interface VerdictBarProps {
  /** Says what the number is, e.g. `measured wall-time ratio`. */
  label: string;
  /** Rendered value, e.g. `4.21× generation / direct`. */
  ratio: string;
  note: string;
}

export function VerdictBar({ label, ratio, note }: VerdictBarProps) {
  return (
    <section
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-foreground px-6 py-5 text-background"
    >
      <span className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-70">{label}</span>
      <strong
        className="metric-value font-mono text-xl font-medium whitespace-nowrap sm:text-2xl"
        data-testid="ratio"
      >
        {ratio}
      </strong>
      <p className="basis-full text-xs leading-relaxed opacity-70">{note}</p>
    </section>
  );
}
