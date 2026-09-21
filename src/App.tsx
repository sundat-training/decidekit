import { useMemo } from "react";
import { RouterProvider } from "react-router";

import { InferenceConfigProvider } from "@/hooks/useInferenceConfig";
import { LabProvider } from "@/hooks/useLab";
import type { WebGPUProbe, WorkerFactory } from "@/hooks/useInference";
import { appRouter, createAppRouter } from "@/router";

export interface AppProps {
  /** Injected in tests so the lab can run without a GPU or a real worker. */
  createWorker?: WorkerFactory;
  probe?: WebGPUProbe;
  /** Lets a test supply a router with its own history. */
  router?: ReturnType<typeof createAppRouter>;
}

export function App({ createWorker, probe, router }: AppProps = {}) {
  const config = useMemo(() => ({ createWorker, probe }), [createWorker, probe]);

  return (
    <InferenceConfigProvider value={config}>
      <LabProvider>
        <RouterProvider router={router ?? appRouter} />
      </LabProvider>
    </InferenceConfigProvider>
  );
}
