import { describe, expect, it } from "vitest";
import { ASSESSOR_TOOLS } from "@/lib/assessor/tools";

describe("ASSESSOR_TOOLS", () => {
  it("registers the end_session webhook tool against the end route", () => {
    const endSession = ASSESSOR_TOOLS.find((tool) => tool.name === "end_session");
    expect(endSession).toBeDefined();
    expect(endSession?.method).toBe("POST");
    expect(endSession?.path).toBe("/api/assessor/end/{session_id}");
  });

  it("still registers the get_session_state read tool", () => {
    const state = ASSESSOR_TOOLS.find((tool) => tool.name === "get_session_state");
    expect(state?.method).toBe("GET");
    expect(state?.path).toBe("/api/assessor/session-state/{session_id}");
  });

  it("still registers the set_phase advance tool", () => {
    const phase = ASSESSOR_TOOLS.find((tool) => tool.name === "set_phase");
    expect(phase?.method).toBe("POST");
    expect(phase?.path).toBe("/api/assessor/phase/{session_id}");
  });

  it("gives every tool a path bound to the session_id dynamic variable", () => {
    for (const tool of ASSESSOR_TOOLS) {
      expect(tool.path).toContain("{session_id}");
    }
  });
});