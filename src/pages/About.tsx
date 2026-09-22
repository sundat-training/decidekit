import { Link } from "react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Limitations } from "@/components/app/Limitations";
import { MethodMap } from "@/components/app/MethodMap";
import { ModelQualityTable } from "@/components/app/ModelQualityTable";
import { SectionHeading } from "@/components/app/SectionHeading";
import { DEFAULT_MODEL_ID, MODELS } from "@/lib/models";

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "One decision, two requests",
    body: "State, question and options are rendered into one user message, and the system prompt is identical for both paths. The user instruction is not: readout A asks for a single option letter, readout B asks the model to write the whole distribution out. Each readout poses its own version of the question, so the two can name different options.",
  },
  {
    title: "Readout A: read the distribution",
    body: "A grammar restricts decoding to the single-letter option labels A…T, and a logit bias pins those token ids. The engine returns the log-probability of each option's token, which is normalized with a softmax across exactly the displayed options. Two or twenty options cost one forward pass.",
  },
  {
    title: "Readout B: generate the distribution",
    body: "The model writes its own estimate of that distribution as a JSON object, token by token, capped at 512 tokens. Every chunk is streamed to the page. The finished object must contain exactly the expected keys, values inside [0, 1], and sum to one within 0.02.",
  },
  {
    title: "Sequential, not parallel",
    body: "Both paths run on one loaded model, one after the other, so they never contend for the same GPU. Model load and shader warmup are reported separately and excluded from the comparison.",
  },
];

export function About() {
  return (
    <>
      <section className="py-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          About
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
          A live, local experiment in reading decisions.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
          A local model can read out probabilities for your allowed options without decoding a
          single token — or write its own estimate of them as JSON, token by token. This page
          explains what the lab measures, how each readout works, and what the resulting numbers do
          not tell you.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Normally a decision has to be read out of generated text and parsed back into a value. The
          direct path skips that round trip. The generation path keeps it. The model, the state, the
          question and the options are held constant, so what separates the two answers is how the
          model was asked for them and how they were read.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/">Open the lab</Link>
          </Button>
          <Badge variant="outline">browser only</Badge>
          <Badge variant="outline">no backend</Badge>
          <Badge variant="outline">your timings</Badge>
        </div>
      </section>

      <section aria-labelledby="why-title" className="flex flex-col gap-6">
        <SectionHeading
          index="01"
          label="premise"
          id="why-title"
          title="Why two readout paths"
          description="A model's answer and its confidence are produced by the same forward pass. This lab separates the two ways of getting at the second one."
        />
        <Card className="py-6">
          <CardContent className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
            <p className="max-w-prose">
              Asking a model to classify means asking it to produce a token sequence you then have
              to interpret. That interpretation step is where most of the cost and most of the
              fragility lives: the model can answer with an explanation, with a synonym, or wrapped
              in a code fence, and the caller has to cope.
            </p>
            <p className="max-w-prose">
              The direct readout removes that step. Instead of reading what the model says, the lab
              reads the probability the model assigned to each allowed option in a single
              constrained position. That number exists whether or not the model ever writes it down.
            </p>
            <p className="max-w-prose">
              The generation readout is the control: the same model, the same state and the same
              options, asked to write its distribution out instead of having it read — which is what
              most applications actually do. It is a different request, so it can name a different
              option. Running both makes that difference visible instead of assumed.
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <SectionHeading
          index="02"
          label="method"
          id="how-title"
          title="How a run works"
          description="One loaded model, one decision, two ways of asking for and reading the answer. The order is fixed and the paths never overlap."
        />
        <MethodMap modelShort={MODELS[DEFAULT_MODEL_ID].short} optionCount={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="py-5">
              <CardContent className="flex flex-col gap-2 pt-0">
                <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  step {index + 1}
                </span>
                <h3 className="text-sm font-medium">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="models-title" className="flex flex-col gap-6">
        <SectionHeading
          index="03"
          label="models"
          id="models-title"
          title="What is loaded"
          description="Three quantized tiers, each pinned to a fixed revision. The browser downloads the weights directly from Hugging Face."
        />
        <ModelQualityTable />
        <Alert tone="warning">
          <AlertDescription>
            The quality columns come from the upstream project's native-checkpoint evaluations, plus
            the published TypeSafe value for the hosted Jev baseline. They are reference numbers,
            not measurements of these quantized browser weights.
          </AlertDescription>
        </Alert>
      </section>

      <section aria-labelledby="limits-title" className="flex flex-col gap-6">
        <SectionHeading
          index="04"
          label="limits"
          id="limits-title"
          title="What the numbers do not say"
          description="Four caveats that apply to every value the lab prints."
        />
        <Limitations />
      </section>

      <section aria-labelledby="privacy-title" className="flex flex-col gap-6">
        <SectionHeading
          index="05"
          label="privacy"
          id="privacy-title"
          title="What stays on your machine"
          description="There is no server side to this project, by design and by test."
        />
        <Card className="py-6">
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <p className="max-w-prose">
              Weights are fetched from Hugging Face and stay in the browser cache. The request
              carries no referrer, so the hosting URL is not shared with the download host.
              Inference runs in a Web Worker on your GPU.
            </p>
            <p className="max-w-prose">
              The state, the question and the options never leave the page. There is no API route,
              no WebSocket and no telemetry — a source-level test fails the build if that ever
              changes. The build output is a folder of static files you can host anywhere.
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="built-title" className="flex flex-col gap-6">
        <SectionHeading
          index="06"
          label="built with"
          id="built-title"
          title="Standing on other work"
          description="DecideKit is a port, not an original research effort."
        />
        <Card className="py-6">
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <p className="max-w-prose">
              Ported from the{" "}
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href="https://github.com/TheoLeeCJ/SemIf"
                target="_blank"
                rel="noreferrer noopener"
              >
                SemIf browser lab
              </a>{" "}
              (formerly OpenJev), which defined the comparison this lab reproduces. Browser
              inference is done by{" "}
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href="https://github.com/ngxson/wllama"
                target="_blank"
                rel="noreferrer noopener"
              >
                wllama
              </a>
              , vendored at a pinned version.
            </p>
            <p className="max-w-prose">
              The interface is React with Tailwind CSS and shadcn-style primitives, tested in a real
              browser. Full attribution, including the pinned model revisions and the licences of
              every dependency, is in <code className="font-mono text-xs">THIRD_PARTY.md</code>.
            </p>
            <p className="max-w-prose">
              DecideKit is an independent project. It is not affiliated with or endorsed by
              TypeSafe, and none of the local tiers is claimed to match the published hosted
              baseline.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
