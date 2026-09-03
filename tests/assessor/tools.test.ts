import { describe, expect, it } from "vitest";
import { ASSESSOR_TOOLS, buildWebhookToolConfig, type WebhookToolSpec } from "@/lib/assessor/tools";

const BASE_URL = "https://app.example.com";
const SECRET = "secret-123";

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

describe("buildWebhookToolConfig", () => {
  it("builds a GET tool config without a body schema", () => {
    const tool = ASSESSOR_TOOLS.find((t) => t.method === "GET")!;
    const config = buildWebhookToolConfig(tool, { baseUrl: BASE_URL, secret: SECRET });

    expect(config.type).toBe("webhook");
    expect(config.name).toBe(tool.name);
    expect(config.api_schema.url).toBe(`${BASE_URL}${tool.path}`);
    expect(config.api_schema.method).toBe("GET");
    expect(config.api_schema.request_headers).toEqual({ "x-assessor-tool-secret": SECRET });
    expect(config.api_schema.request_body_schema).toBeUndefined();
    expect(config.api_schema.content_type).toBeUndefined();
    expect(config.response_timeout_secs).toBe(30);
  });

  it("builds a POST tool config with its request body schema and content type", () => {
    const tool = ASSESSOR_TOOLS.find((t) => t.method === "POST")!;
    const config = buildWebhookToolConfig(tool, { baseUrl: BASE_URL, secret: SECRET });

    expect(config.api_schema.method).toBe("POST");
    expect(config.api_schema.request_body_schema).toEqual(tool.requestBodySchema);
    expect(config.api_schema.content_type).toBe("application/json");
  });

  it("rejects a POST tool that carries no request body schema", () => {
    const post = ASSESSOR_TOOLS.find((t) => t.method === "POST")!;
    const broken = { ...post, requestBodySchema: undefined } as unknown as WebhookToolSpec;

    expect(() => buildWebhookToolConfig(broken, { baseUrl: BASE_URL, secret: SECRET })).toThrow(
      /requires a request body schema/,
    );
  });

  it("strips a trailing slash from the base URL", () => {
    const tool = ASSESSOR_TOOLS.find((t) => t.method === "GET")!;
    const config = buildWebhookToolConfig(tool, { baseUrl: "https://app.example.com/", secret: SECRET });
    expect(config.api_schema.url).not.toContain("//api/");
    expect(config.api_schema.url).toBe(`https://app.example.com${tool.path}`);
  });
});