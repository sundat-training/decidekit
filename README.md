# DecideKit

Live: <https://sundat-training.github.io/decidekit/>

A browser-only lab that compares two ways of reading a decision out of one local
model:

1. **Direct readout** — one constrained forward pass. The inference engine
   returns the log-probabilities of the allowed single-token option labels
   (A…T), which are then normalized with a softmax over exactly the displayed
   options. Two to twenty options cost one readout.
2. **Generation** — the same model writes its own estimate of that distribution as
   JSON, token by token, capped at 512 tokens. Every streamed token is shown, and
   the result is validated: exact keys, values inside `[0, 1]`, sum within `0.02`
   of one.

The two prompts contain identical state, question and option text. Their final
format instructions differ: the direct readout asks for one option letter, the
generation asks the model to report a distribution as JSON. Those generated,
self-reported probabilities are a separate readout and need not match the direct
token probabilities.

This is a live experiment, not a benchmark. The page shows only timings measured
in the current tab. Model load and shader warmup are reported separately from
both paths, and the paths run sequentially so they never contend for one GPU.

Both readouts run by default, the way the original lab measured them. The
readouts section of the setup area can narrow a run to the direct readout or to
the generation alone. A path that is not selected is
skipped entirely — not computed and not rendered — so a run costs only what it
asks for. Restricting to one path also means there is no ratio to report: a
single readout has nothing to be compared against.

Ported from the SemIf browser lab (formerly OpenJev).

## Requirements

- Node.js 20+ and pnpm (the version is pinned in `package.json`)
- A WebGPU-capable browser over HTTPS or `localhost`
- Room for the selected tier on first load: 639 MB, 1.56 GB or 3.01 GB

## Quick start

```bash
pnpm install
pnpm run dev
```

Open the printed localhost URL. The page checks WebGPU first and downloads a
model only after you press load.

On localhost, `?local` makes the worker read `public/assets/<tier>.gguf` instead
of Hugging Face. Place that file yourself; `public/assets/` is gitignored.

## Cases file

The editor is optional. Instead of typing one decision, the decision section
also takes a JSON file and runs every case in it, in order, on the same loaded
model:

```json
{
  "cases": [
    {
      "id": "account-support",
      "type": "decision",
      "input": {
        "state": "A password reset succeeded, but logins still fail.",
        "question": "Which queue should handle this request?",
        "options": ["Account access support", "Billing support", "Close as resolved"]
      }
    }
  ]
}
```

`cases` must hold at least one entry. `type` is optional and defaults to
`decision`, the only type this build runs; `id` is optional and defaults to
`<type> <position>`. Ids must be unique. Each `input` is checked with the same
rules as the editor — a nonempty state, question and options, and two to twenty
options — and a rejected file reports the failing path while leaving the cases
already loaded in place.

The selected readout applies to every case. Cases run one after the other
because they share one engine. Each case gets a table row led by its winning
option — label, text and value — with the remaining options receding to a single
dim line, plus the wall time of that case and a total over all cases. The file is
read as text in the page; nothing in it is uploaded anywhere.

A ready-to-load example ships with the site at `public/examples/cases.json`
(served as `/examples/cases.json`), and a test fails if it ever stops parsing. A
shorter two-case file, `public/examples/cases-two.json`, is offered as a
download next to the file picker.

Loading a file clears whatever ran before it, and returning to the editor clears
what the cases produced, so a number on screen always belongs to the input next
to it.

## Scripts

| Command               | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `pnpm run dev`        | Vite dev server with the cross-origin isolation headers       |
| `pnpm run build`      | Typecheck via project references, then build to `dist/`       |
| `pnpm run preview`    | Serve the built `dist/` with the same headers                 |
| `pnpm test`           | Vitest in browser mode (headless Chromium through Playwright) |
| `pnpm run test:watch` | The same suite in watch mode                                  |
| `pnpm run typecheck`  | `tsc -b` across the app, worker and config projects           |
| `pnpm run lint`       | oxlint with autofix and unused-directive reporting            |
| `pnpm run lint:typed` | oxlint with the type-aware engine (tsgolint)                  |
| `pnpm run fmt`        | oxfmt, writing in place                                       |
| `pnpm run fmt:check`  | oxfmt in check mode                                           |

## Package manager

pnpm is the only package manager used here. `package.json` pins it through
`packageManager` and `pnpm-lock.yaml` is the single lockfile. Two pnpm-owned
files sit next to it:

- `pnpm-workspace.yaml` records the release-age exceptions pnpm needed to
  install the current `oxlint` and `oxfmt` versions.
- Both that file and the lockfile are excluded from `oxfmt`, so the formatter
  and pnpm never fight over their contents.

## Linting and formatting

`oxlint` and `oxfmt` need no plugin install step. Configuration lives in
`.oxlintrc.json` and `.oxfmtrc.json`, and `fmt`/`fmt:check` also cover Markdown
and JSON.

Two rules are deliberately off, both explained in the config:

- `unicorn/require-post-message-target-origin` only knows the `Window`
  signature, so it fires on every `Worker.postMessage`, which takes no target
  origin.
- `typescript/no-unsafe-type-assertion` is stricter than the boundaries in this
  codebase need: a dynamically imported untyped vendored module, DOM element
  narrowing in tests, and reading a record after a structural check.
  `typescript/no-unnecessary-type-assertion` stays on and still catches casts
  that do nothing.

`pnpm run lint` skips the rules that need type information; `pnpm run lint:typed`
adds them:

```bash
pnpm run lint:typed
```

## Architecture

```
src/
  lib/                 pure logic: decision contract, case files, model pins, download tracking, formatting
  lib/inference/       both readout paths against a narrow completion client, plus the worker protocol
  worker/              the Web Worker driver and the vendored wllama loader
  hooks/               useInference (worker lifecycle, state machine), useLab (state above the router)
  components/ui/       shadcn-style primitives on Tailwind v4 tokens
  components/app/      shared page sections and the site chrome
  pages/               one component per route: Lab, About, NotFound
  router.tsx           route table, browser history, scroll restoration
public/
  vendor/wllama/       vendored wllama 3.6.1 runtime (MIT) and its wasm
  _headers             COOP/COEP and Referrer-Policy for static hosts
  _redirects           single-page-app fallback for hosts that read it
```

The worker is loaded with `new Worker(new URL(...), { type: "module" })` so Vite
bundles it. The vendored engine itself is deliberately not bundled: it is fetched
at runtime from `/vendor/wllama/index.js` because the prebuilt WASM runtime
resolves its own assets relative to its script URL.

The lab's worker, loaded model, edited decision and imported cases live in
`useLab`, which is mounted **above** the router. Navigating to another route
therefore does not throw away a model that took minutes to download and
compile. Keep it that way: state that belongs to a run must not move into a
route component.

Every run is a list of cases, and the editor produces a list of one. The queue
lives in `useInference` and posts the next `compare` only after the previous
`complete`, because the worker does not serialize its messages itself.

## Deployment

Any static HTTPS host: run `pnpm run build` and upload `dist/`. No server,
database, API, telemetry or server-side inference is involved, and there is no
build step at runtime.

Cross-origin isolation is what allows the WASM runtime to use more than one
thread, and it is delivered one of two ways:

- **Hosts that read `_headers`** (Cloudflare Pages, Netlify, and similar) send
  `COOP`/`COEP` as real response headers. `_headers` also carries
  `Referrer-Policy: no-referrer`, so the hosting URL is not sent to Hugging Face.
- **Hosts without header control** (GitHub Pages) get the two headers from the
  vendored `coi-serviceworker.js`, which rewrites every response from a service
  worker. The document keeps the referrer policy through the `<meta name="referrer">`
  tag in `index.html`. The service worker only takes effect from the second load
  on — the first visit registers it and reloads once — and it needs a secure
  context, so HTTPS (or `localhost`).

Routing is client-side, so the host has to serve `index.html` for unknown paths
or a direct visit to `/about` will 404. `_redirects` covers Cloudflare Pages and
Netlify. GitHub Pages ignores it, so the deploy workflow copies `index.html` to
`dist/404.html` as the fallback.

A GitHub Pages **project site** is served from `/<repo>/`, so that build needs
the prefix in two places: pass `BASE_PATH=/decidekit/` to `pnpm run build` (the
bundler's base) and the router reads the same prefix through `import.meta.env.BASE_URL`.
Root-served hosts and local development keep `BASE_PATH` unset.

## Testing

`pnpm test` runs the suite in a real browser, so DOM behaviour is tested as it
ships rather than in a simulated environment:

- **Pure logic** — softmax, logit extraction (letter and single-byte tokens),
  generation validation, option bounds, case file validation, download
  aggregation.
- **Inference paths** — both readouts against a fake completion client with an
  injected clock, including the rejection paths for a stream where a single
  completion was expected and vice versa.
- **Source contract** — no backend surface, every model pinned to a revision,
  limitations and cross-origin headers still present, vendored engine served.
- **Component behaviour** — the page rendered with a stub worker and a stub
  WebGPU probe, so the suite needs neither a GPU nor a model download.
- **Routing** — client-side navigation, deep links to each route, the not-found
  path, and that a loaded model and an edited decision survive leaving the lab.

## Pins

- wllama `3.6.1`, vendored under `public/vendor/wllama`
- Model revisions are fixed in `src/lib/models.ts` and asserted by tests
- The UI is React 19 with `react-router`, Tailwind CSS v4 and shadcn-style
  components; the upstream Vue CDN build and the Material Symbols CDN are gone,
  and the fonts are self-hosted

## Limitations

- Direct scores are conditional on the displayed label tokens. They are not
  calibrated confidence, so a high value does not mean the decision is correct.
- The `cached` marker in the model list is a record of the tiers this browser has
  already loaded, kept in `localStorage`. A page cannot query the HTTP cache, so
  the marker is a strong hint rather than a live reading: the browser may evict
  an entry between visits.
- The reference quality numbers come from native checkpoints, not from these
  quantized GGUF builds.
- Timings are one machine's wall-clock smoke tests, not portable performance
  claims.

## License

MIT. Ported from SemIf (MIT, © 2026 TheoLeeCJ). See `THIRD_PARTY.md` for the
full attribution.
