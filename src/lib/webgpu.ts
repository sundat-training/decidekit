export interface WebGPUStatus {
  ok: boolean;
  message: string;
}

/** WebGPU types are not part of the DOM lib, so only the used surface is typed. */
interface GPUProbe {
  requestAdapter(): Promise<unknown>;
}

function gpu(): GPUProbe | undefined {
  return (navigator as Navigator & { gpu?: GPUProbe }).gpu;
}

/**
 * The page reports its compatibility before any model download starts, so a
 * visitor without WebGPU never pays for bytes it cannot use.
 */
export async function probeWebGPU(): Promise<WebGPUStatus> {
  const api = gpu();
  if (!api) {
    return {
      ok: false,
      message:
        "WebGPU is unavailable. Use a current WebGPU-capable browser over HTTPS or localhost.",
    };
  }
  const adapter = await api.requestAdapter();
  if (!adapter) {
    return {
      ok: false,
      message: "WebGPU exists, but no GPU adapter is available in this browser.",
    };
  }
  return { ok: true, message: "WebGPU is ready. The model does not download until you load it." };
}
