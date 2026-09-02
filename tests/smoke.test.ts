import { describe, expect, it } from "vitest";
import pkg from "@/package.json";

describe("test harness", () => {
  it("runs a trivial TypeScript test", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/* path alias", () => {
    expect(pkg.name).toBe("code-with-me");
  });
});