import type { PyodideInterface } from "pyodide";
import type { BuildRunScriptInput } from "@/lib/run/build-script";
import { buildRunScript } from "@/lib/run/build-script";
import { parseRunOutput } from "@/lib/run/parse-output";
import type { RunResult } from "@/lib/run/result";

/**
 * Pyodide runs the Candidate's code in-browser. The loader is fetched at
 * runtime from jsDelivr (skipping the bundler via `webpackIgnore`, which both
 * webpack and Turbopack honour) so the multi-megabyte WebAssembly build is
 * never shipped as part of the app bundle. The `pyodide` npm package is used
 * for types only.
 */
const PYODIDE_VERSION = "314.0.6" as const;
const PYODIDE_ENTRY = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let runtimePromise: Promise<PyodideInterface> | null = null;

function getRuntime(): Promise<PyodideInterface> {
  runtimePromise ??= (async () => {
    const pyodideModule = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ PYODIDE_ENTRY
    )) as typeof import("pyodide");
    return pyodideModule.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  })();
  return runtimePromise;
}

/** Warms the runtime so the first Run does not pay the download cost. */
export function ensurePyodideReady(): Promise<void> {
  return getRuntime().then(() => undefined);
}

export type RunExecution =
  | { kind: "complete"; result: RunResult }
  | { kind: "error"; message: string };

/**
 * Executes the Candidate's code in-browser against the hidden test suite and
 * returns the visible pass/fail counts. Errors (syntax failures, a broken
 * harness, the runtime failing to load) surface as a sanitised message — never
 * a traceback that could leak hidden test inputs.
 */
export async function executeRun(input: BuildRunScriptInput): Promise<RunExecution> {
  const script = buildRunScript(input);
  try {
    const runtime = await getRuntime();
    const output = await runtime.runPythonAsync(script);
    const result = parseRunOutput(String(output));
    if (!result) {
      console.error("Unparseable Run output from Pyodide:", output);
      return { kind: "error", message: "The runner returned an unexpected result." };
    }
    return { kind: "complete", result };
  } catch (error) {
    console.error("Run failed to execute:", error);
    return { kind: "error", message: "That code could not be run. Check for syntax errors." };
  }
}