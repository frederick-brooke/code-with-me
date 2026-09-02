import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRunScript } from "@/lib/run/build-script";
import { extractFunctionName } from "@/lib/run/function-name";
import { parseRunOutput } from "@/lib/run/parse-output";
import { seedProblems } from "@/lib/data/seeds/problems";
import type { TestCase } from "@/lib/data/types";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function hasPython3(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const RUNNER = [
  "import ast, sys",
  "ns = {}",
  "src = open(sys.argv[1]).read()",
  "tree = ast.parse(src)",
  "exec(compile(tree, '<run>', 'exec'), ns)",
  "print(eval(compile(ast.Expression(tree.body[-1].value), '<run>', 'eval'), ns))",
].join("\n");

/** Runs the built script like Pyodide does (the last expression is the result). */
function runScriptWithPython(script: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cwm-run-"));
  tmpDirs.push(dir);
  const runnerPath = path.join(dir, "runner.py");
  const scriptPath = path.join(dir, "script.py");
  writeFileSync(runnerPath, RUNNER);
  writeFileSync(scriptPath, script);
  return execFileSync("python3", [runnerPath, scriptPath], { encoding: "utf8" }).trim();
}

describe("extractFunctionName", () => {
  it("extracts the def name from a seeded starter template", () => {
    expect(extractFunctionName("def two_sum(nums, target):\n    pass\n")).toBe("two_sum");
    expect(extractFunctionName("def is_valid(s):\n    pass\n")).toBe("is_valid");
  });

  it("returns null when no definition is present", () => {
    expect(extractFunctionName("# no function here\n")).toBeNull();
  });

  it("keeps type-annotated signatures", () => {
    expect(extractFunctionName("def two_sum(nums: list[int], target: int) -> list[int]:\n    pass\n")).toBe(
      "two_sum",
    );
  });
});

describe("buildRunScript", () => {
  it("embeds the candidate code and the harness in one program", () => {
    const code = "def two_sum(nums, target):\n    pass\n";
    const script = buildRunScript({
      code,
      functionName: "two_sum",
      testCases: [{ input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" }],
    });
    expect(script).toContain(JSON.stringify(code));
    expect(script).toContain("def _result()");
  });
});

describe.skipIf(!hasPython3())(
  "built Run script executed with python3 (Pyodide-equivalent seam)",
  () => {
    function expectCounts(
      code: string,
      problemId: string,
      expected: { passed: number; failed: number },
    ) {
      const problem = seedProblems.find((p) => p.id === problemId);
      expect(problem).toBeDefined();
      const functionName = extractFunctionName(problem!.starterTemplate ?? "");
      expect(functionName).not.toBeNull();
      const script = buildRunScript({
        code,
        functionName: functionName!,
        testCases: problem!.hiddenTests,
      });
      const output = runScriptWithPython(script);
      expect(parseRunOutput(output)).toEqual(expected);
    }

    it("counts a fully working Two Sum solution against the hidden suite", () => {
      expectCounts(
        "def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n",
        "two-sum",
        { passed: 4, failed: 0 },
      );
    });

    it("counts a partially wrong Two Sum solution", () => {
      expectCounts("def two_sum(nums, target):\n    return []\n", "two-sum", { passed: 0, failed: 4 });
    });

    it("reports the hidden suite as all-failed when the target function is renamed", () => {
      expectCounts("def add(nums, target):\n    return [0, 1]\n", "two-sum", { passed: 0, failed: 4 });
    });

    it("counts every hidden test as failed when the solution raises", () => {
      expectCounts(
        "def two_sum(nums, target):\n    raise ValueError('boom')\n",
        "two-sum",
        { passed: 0, failed: 4 },
      );
    });

    it("counts a working Valid Parentheses solution", () => {
      expectCounts(
        "def is_valid(s):\n    while '()' in s or '[]' in s or '{}' in s:\n        s = s.replace('()', '').replace('[]', '').replace('{}', '')\n    return not s\n",
        "valid-parentheses",
        { passed: 4, failed: 0 },
      );
    });

    it("counts a working Trapping Rain Water solution, including the empty-list input", () => {
      expectCounts(
        "def trap(height):\n    n = len(height)\n    if not height:\n        return 0\n    left, right = 0, n - 1\n    max_left = max_right = 0\n    water = 0\n    while left <= right:\n        if height[left] <= height[right]:\n            max_left = max(max_left, height[left])\n            water += max_left - height[left]\n            left += 1\n        else:\n            max_right = max(max_right, height[right])\n            water += max_right - height[right]\n            right -= 1\n    return water\n",
        "trapping-rain-water",
        { passed: 4, failed: 0 },
      );
    });

    it("keeps hidden test inputs out of the harness output", () => {
      const problem = seedProblems.find((p) => p.id === "two-sum");
      const script = buildRunScript({
        code: "def two_sum(nums, target):\n    return [0, 1]\n",
        functionName: "two_sum",
        testCases: problem!.hiddenTests,
      });
      const output = runScriptWithPython(script);
      expect(output).toContain("passed");
      for (const testCase of problem!.hiddenTests as TestCase[]) {
        expect(output.includes(testCase.expectedOutput)).toBe(false);
      }
    });

    it("keeps the harness's internals and test data out of the Candidate's namespace", () => {
      const problem = seedProblems.find((p) => p.id === "two-sum");
      const code =
        "def two_sum(nums, target):\n" +
        "    leaks = [name for name in globals() if name not in (\"two_sum\", \"__builtins__\")]\n" +
        "    if leaks:\n" +
        "        return [0, 1]\n" +
        "    for i in range(len(nums)):\n" +
        "        for j in range(i + 1, len(nums)):\n" +
        "            if nums[i] + nums[j] == target:\n" +
        "                return [i, j]\n" +
        "    return []\n";
      const script = buildRunScript({
        code,
        functionName: "two_sum",
        testCases: problem!.hiddenTests,
      });
      const output = runScriptWithPython(script);
      expect(parseRunOutput(output)).toEqual({ passed: 4, failed: 0 });
    });
  },
);