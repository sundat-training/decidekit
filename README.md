# DecideKit

A browser-only lab that compares two ways of reading a decision out of one local
model:

1. **Direct readout** — one constrained forward pass. The inference engine
   returns the log-probabilities of the allowed single-token option labels
   (A…T), which are then normalized with a softmax over exactly the displayed
   options. Two to twenty options cost one readout.
2. **Generation** — the same model writes the same distribution as JSON, token
   by token, capped at 512 tokens. Every streamed token is shown, and the result
   is validated: exact keys, values inside `[0, 1]`, sum within `0.02` of one.

This is a live experiment, not a benchmark. The page shows only timings measured
in the current tab. Model load and shader warmup are reported separately from
both paths, and the paths run sequentially so they never contend for one GPU.

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
  lib/                 pure logic: decision contract, model pins, download tracking, formatting
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

The lab's worker, loaded model and edited decision live in `useLab`, which is
mounted **above** the router. Navigating to another route therefore does not
throw away a model that took minutes to download and compile. Keep it that way:
state that belongs to a run must not move into a route component.

## Deployment

Any static HTTPS host: run `pnpm run build` and upload `dist/`. No server,
database, API, telemetry or server-side inference is involved, and there is no
build step at runtime.

Keep `_headers` on hosts that read it (Cloudflare Pages, Netlify, and similar).
It keeps the page cross-origin isolated, which is what allows the WASM runtime to
use more than one thread, and it prevents the hosting URL from being sent as a
referrer to Hugging Face.

Routing is client-side, so the host has to serve `index.html` for unknown paths
or a direct visit to `/about` will 404. `_redirects` covers Cloudflare Pages and
Netlify. On other hosts add the equivalent rewrite, or reach the pages through
the in-app navigation.

## Testing

`pnpm test` runs the suite in a real browser, so DOM behaviour is tested as it
ships rather than in a simulated environment:

- **Pure logic** — softmax, logit extraction (letter and single-byte tokens),
  generation validation, option bounds, download aggregation.
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
