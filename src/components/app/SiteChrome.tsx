import { Activity } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-xl tracking-tight">DecideKit</span>
        <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          browser decision lab
        </span>
      </div>
      <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <Activity className="size-3.5" aria-hidden="true" />
        local models · no backend · nothing leaves this page
      </p>
    </header>
  );
}

export interface SiteFooterProps {
  modelRepo: string;
}

export function SiteFooter({ modelRepo }: SiteFooterProps) {
  return (
    <footer className="mt-16 flex flex-col gap-3 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>DecideKit · ported from the SemIf browser lab</p>
      <p className="max-w-md">
        An independent project, not affiliated with or endorsed by TypeSafe. Reference scores come
        from native checkpoints, not from these quantized browser weights.
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a className="underline underline-offset-4 hover:text-foreground" href="#limitations">
          limitations
        </a>
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href={modelRepo}
          target="_blank"
          rel="noreferrer noopener"
        >
          selected model
        </a>
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href="https://github.com/ngxson/wllama"
          target="_blank"
          rel="noreferrer noopener"
        >
          wllama
        </a>
      </p>
    </footer>
  );
}
