# Third-party material

No model weights are distributed with this repository. The browser downloads
them from Hugging Face at runtime, pinned to a fixed revision.

## Upstream project

| Item | Upstream | Note |
| --- | --- | --- |
| SemIf browser lab (formerly OpenJev) | https://github.com/TheoLeeCJ/SemIf | This project is a port of `webgpu-demo/`. MIT, © 2026 TheoLeeCJ. The MIT notice is retained in `LICENSE`. |

## Vendored runtime

| Item | Upstream | Pinned revision | Note |
| --- | --- | --- | --- |
| wllama | https://github.com/ngxson/wllama | `3.6.1` | Browser inference runtime and its WASM build, vendored under `public/vendor/wllama/`. MIT, © 2024 Xuan Son NGUYEN; the licence text ships next to the build. |

## Build and UI dependencies

| Item | Upstream | Note |
| --- | --- | --- |
| React, React DOM | https://github.com/facebook/react | MIT |
| Vite, Vitest, Playwright | https://github.com/vitejs/vite, https://github.com/vitest-dev/vitest, https://github.com/microsoft/playwright | MIT / Apache-2.0 |
| Tailwind CSS | https://github.com/tailwindlabs/tailwindcss | MIT |
| shadcn/ui, Radix UI primitives | https://github.com/shadcn-ui/ui, https://github.com/radix-ui/primitives | MIT |
| Lucide icons | https://github.com/lucide-icons/lucide | ISC |
| Newsreader, IBM Plex Sans, IBM Plex Mono | https://github.com/googlefonts/newsreader, https://github.com/IBM/plex | SIL Open Font License 1.1, self-hosted through `@fontsource` |

## Browser models

Weights are not redistributed. The download URLs in `src/lib/models.ts` pin the
following revisions:

| Item | Upstream | Pinned revision | Note |
| --- | --- | --- | --- |
| Qwen3-0.6B GGUF | https://huggingface.co/Qwen/Qwen3-0.6B-GGUF | `23749fefcc72300e3a2ad315e1317431b06b590a` | Q8_0; check the upstream model licence. |
| MiniCPM5-2B GGUF | https://huggingface.co/openbmb/MiniCPM5-2B-GGUF | `2079a22f3beaa4e306449978533478fe0522f4b3` | Q4_K_M; Apache-2.0 on its model card. |
| Qwen3.5-4B GGUF | https://huggingface.co/bartowski/Qwen_Qwen3.5-4B-GGUF | `4168f45a16a1290d65a4ec0fa312ae917a4c15d6` | Q4_K_M; check the upstream model licence. |

## Reference scores

The quality columns in the UI are reference numbers from the upstream project's
native-checkpoint evaluations, plus the published TypeSafe value for the hosted
Jev baseline. They are not measured by this page and not measured on these
quantized browser weights.

DecideKit is an independent project and is not affiliated with or endorsed by
TypeSafe. Jev, TypeSafe and other names and marks belong to their respective
owners.
