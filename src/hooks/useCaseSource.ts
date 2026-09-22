import { useCallback, useMemo, useState } from "react";

import { parseCaseFile, type Case } from "@/lib/cases";

export interface CaseSource {
  /** The loaded cases. Empty means the editor supplies the input. */
  cases: Case[];
  /** Name of the last file an import was attempted with, or null. */
  fileName: string | null;
  /** Why that file was rejected, or null while it parsed. */
  error: string | null;
  loadFile: (file: File) => Promise<void>;
  clear: () => void;
}

/**
 * The file that can replace the editor's input.
 *
 * A rejected file leaves the cases already loaded in place, so a typo in a new
 * file never silently empties a run the visitor prepared. Loading or dropping
 * cases changes which input a run reads, which is what `onSourceChange` is for:
 * the readouts of the previous input must not outlive it.
 */
export function useCaseSource(onSourceChange: () => void): CaseSource {
  const [cases, setCases] = useState<Case[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = parseCaseFile(text);
      setFileName(file.name);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      setError(null);
      onSourceChange();
      setCases(parsed.cases);
    },
    [onSourceChange],
  );

  const clear = useCallback(() => {
    onSourceChange();
    setCases([]);
    setFileName(null);
    setError(null);
  }, [onSourceChange]);

  return useMemo(
    () => ({ cases, fileName, error, loadFile, clear }),
    [cases, fileName, error, loadFile, clear],
  );
}
