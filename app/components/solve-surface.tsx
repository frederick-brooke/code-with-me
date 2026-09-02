"use client";

import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useState, type ReactNode, useSyncExternalStore } from "react";
import type { Problem } from "@/lib/data/types";
import { extractFunctionName } from "@/lib/run/function-name";
import { executeRun, ensurePyodideReady } from "@/lib/run/pyodide";
import type { RunResult } from "@/lib/run/result";
import { recordRunAction } from "@/app/actions/sessions";
import { pillButtonClassName } from "@/app/components/pill-button";

function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia("(prefers-color-scheme: dark)");
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

function formatCounts(passed: number, failed: number): string {
  return `${passed} passed · ${failed} failed`;
}

function runLabel(status: RunStatus): ReactNode {
  switch (status.kind) {
    case "complete":
      return <span>{formatCounts(status.result.passed, status.result.failed)}</span>;
    case "error":
      return <span className="text-red-600 dark:text-red-400">{status.message}</span>;
    case "running":
      return <span>Running…</span>;
    case "preparing":
      return <span>Preparing the Python runtime…</span>;
    case "idle":
      return null;
  }
}

type RunStatus =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "running" }
  | { kind: "complete"; result: RunResult }
  | { kind: "error"; message: string };

export function SolveSurface({
  sessionId,
  problem,
  initialCode,
  initialPassed,
  initialFailed,
}: {
  sessionId: string;
  problem: Problem;
  initialCode: string;
  initialPassed: number;
  initialFailed: number;
}) {
  const prefersDark = usePrefersDark();
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<RunStatus>({ kind: "preparing" });
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const hasResults = initialPassed > 0 || initialFailed > 0;

  useEffect(() => {
    ensurePyodideReady()
      .then(() => setStatus({ kind: "idle" }))
      .catch(() => setStatus({ kind: "error", message: "The Python runtime could not load." }));
  }, []);

  async function handleRun() {
    if (busy) {
      return;
    }
    const functionName = extractFunctionName(problem.starterTemplate ?? "");
    if (!functionName) {
      setStatus({ kind: "error", message: "This Problem does not have a solvable starter template." });
      return;
    }
    setBusy(true);
    setSaveFailed(false);
    setStatus({ kind: "running" });

    const execution = await executeRun({
      code,
      functionName,
      testCases: problem.hiddenTests,
    });

    if (execution.kind === "error") {
      setStatus({ kind: "error", message: execution.message });
      setBusy(false);
      return;
    }

    const result = execution.result;
    setStatus({ kind: "complete", result });
    try {
      const saved = await recordRunAction(sessionId, {
        code,
        passedCount: result.passed,
        failedCount: result.failed,
      });
      setSaveFailed(!saved.ok);
    } catch {
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="overflow-hidden rounded-2xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-black">
          <CodeMirror
            value={code}
            onChange={(value) => setCode(value)}
            height="420px"
            extensions={[python()]}
            theme={prefersDark ? oneDark : "light"}
            basicSetup={{ foldGutter: false }}
            className="text-sm"
            aria-label="Python code editor"
          />
        </section>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {status.kind === "idle"
              ? hasResults
                ? `Latest saved Run: ${formatCounts(initialPassed, initialFailed)}`
                : "Run your code against the hidden tests."
              : runLabel(status)}
          </p>
          <button
            type="button"
            onClick={handleRun}
            disabled={busy}
            className={`${pillButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Run
          </button>
        </div>

        {saveFailed && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            The Run finished, but it could not be saved to this Session.
          </p>
        )}
      </div>

      <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-6">
        <section className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm leading-7 text-zinc-600 dark:border-white/[.145] dark:bg-black dark:text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Question
          </span>
          <p className="mt-3 whitespace-pre-wrap">{problem.statement}</p>
        </section>

        {problem.sampleTests.length > 0 && (
          <section className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm leading-7 text-zinc-600 dark:border-white/[.145] dark:bg-black dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sample tests
            </span>
            <ul className="mt-3 flex flex-col gap-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {problem.sampleTests.map((test, index) => (
                <li key={index} className="flex flex-col gap-1">
                  <code>{test.input}</code>
                  <code>→ {test.expectedOutput}</code>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}