import { Activity } from "lucide-react";
import { NavLink } from "react-router";

import { DEFAULT_MODEL_ID, MODELS } from "@/lib/models";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Lab", end: true },
  { to: "/about", label: "About", end: false },
] as const;

export function SiteHeader() {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="flex items-baseline gap-3">
        <NavLink to="/" className="font-display text-xl tracking-tight">
          DecideKit
        </NavLink>
        <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          browser decision lab
        </span>
      </div>

      <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {NAV.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "font-mono text-[11px] tracking-[0.14em] uppercase underline-offset-4 transition-colors",
                isActive
                  ? "text-foreground underline decoration-direct decoration-2"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            {label}
          </NavLink>
        ))}
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <Activity className="size-3.5" aria-hidden="true" />
          nothing leaves this page
        </span>
      </nav>
    </header>
  );
}

export interface SiteFooterProps {
  /** Links the footer to the model behind the current selection. */
  modelRepo?: string;
}

export function SiteFooter({ modelRepo = MODELS[DEFAULT_MODEL_ID].repo }: SiteFooterProps) {
  return (
    <footer className="mt-16 flex flex-col gap-3 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
      <p>DecideKit · ported from the SemIf browser lab</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <NavLink className="underline underline-offset-4 hover:text-foreground" to="/">
          lab
        </NavLink>
        <NavLink className="underline underline-offset-4 hover:text-foreground" to="/about">
          about
        </NavLink>
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href="https://github.com/ngxson/wllama"
          target="_blank"
          rel="noreferrer noopener"
        >
          wllama
        </a>
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href={modelRepo}
          target="_blank"
          rel="noreferrer noopener"
        >
          model on Hugging Face
        </a>
      </p>
    </footer>
  );
}
