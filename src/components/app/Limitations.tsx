import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LIMITATIONS = [
  {
    id: "conditional",
    title: "Direct scores are conditional probabilities",
    body: "The direct readout takes a softmax over only the displayed option tokens. It is not calibrated confidence and it excludes every answer the model might have preferred instead, so a high value does not mean the decision is correct.",
  },
  {
    id: "tiers",
    title: "The model tiers trade size against accuracy",
    body: "The phone tier is small by design. The default tier targets desktop. The 4B tier needs substantially more memory. None of them is claimed to match the published hosted baseline.",
  },
  {
    id: "timing",
    title: "Every number is a local wall-clock measurement",
    body: "Setup, warmup, prompt preparation, the direct pass, time to first token and full generation are all timed with performance.now() in this tab. Nothing is canned, and the two paths run sequentially so they do not contend for one GPU.",
  },
  {
    id: "quantized",
    title: "Browser weights are quantized",
    body: "The demo loads pinned GGUF builds rather than the native checkpoints behind the reference scores. Quantization can change both quality and speed.",
  },
] as const;

export function Limitations() {
  return (
    <section id="limitations" aria-label="Limitations" className="scroll-mt-8">
      <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-6">
        {LIMITATIONS.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>
              <p className="max-w-prose leading-relaxed text-muted-foreground">{item.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
