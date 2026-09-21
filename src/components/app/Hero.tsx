import { Cpu } from "lucide-react";

export interface HeroProps {
  modelSize: string;
  deviceNote: string;
}

const TRUTHS = ["browser only", "no backend", "your timings"] as const;

export function Hero({ modelSize, deviceNote }: HeroProps) {
  return (
    <section className="relative isolate py-14 sm:py-20">
      <div
        aria-hidden="true"
        className="lab-grid pointer-events-none absolute inset-x-0 -top-10 -z-10 h-40 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        A live, local experiment
      </p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
        Two ways to <span className="text-direct">read a decision</span> from one local model.
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        A local model can read out probabilities for your allowed options without decoding a single
        token — or write the same distribution as JSON, token by token. Load one small model, run
        both paths on your own GPU, and compare what each one costs.
      </p>
      <ul className="mt-8 flex flex-wrap gap-2">
        {TRUTHS.map((truth) => (
          <li
            key={truth}
            className="rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-wide text-muted-foreground"
          >
            {truth}
          </li>
        ))}
        <li className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-wide text-muted-foreground">
          <Cpu className="size-3.5" aria-hidden="true" />
          {modelSize} model
        </li>
      </ul>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{deviceNote}</p>
    </section>
  );
}
