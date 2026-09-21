import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <section className="flex flex-col items-start gap-4 py-16">
      <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">404</p>
      <h1 className="font-display text-3xl tracking-tight">That page does not exist.</h1>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        The lab and its notes are reachable from here.
      </p>
      <Button asChild size="sm">
        <Link to="/">Back to the lab</Link>
      </Button>
    </section>
  );
}
