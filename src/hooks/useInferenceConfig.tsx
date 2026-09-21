import { createContext, useContext, type ReactNode } from "react";

import type { WebGPUProbe, WorkerFactory } from "@/hooks/useInference";

export interface InferenceConfig {
  /** Injected in tests so the lab can run without a GPU or a real worker. */
  createWorker?: WorkerFactory;
  probe?: WebGPUProbe;
}

/**
 * The worker factory and the WebGPU probe live in context rather than in props,
 * so the route tree stays declarative and tests can still inject stubs.
 */
const InferenceConfigContext = createContext<InferenceConfig>({});

export function InferenceConfigProvider({
  value,
  children,
}: {
  value: InferenceConfig;
  children: ReactNode;
}) {
  return (
    <InferenceConfigContext.Provider value={value}>{children}</InferenceConfigContext.Provider>
  );
}

export function useInferenceConfig(): InferenceConfig {
  return useContext(InferenceConfigContext);
}
