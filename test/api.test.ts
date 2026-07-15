import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../src/api";
import { LOADER_IDS } from "../src/domain/loader";
import { account, address, FixtureRpc } from "./fixtures";

describe("API routes", () => {
  it("rejects malformed addresses before making an upstream request", async () => {
    const rpc = new FixtureRpc();
    const response = await handleApiRequest({
      request: new Request("https://slotglass.test/api/inspect?network=mainnet-beta&program=not-an-address"),
      requestId: "route-test",
      rpc,
    });
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PROGRAM_ADDRESS");
    expect(rpc.calls).toEqual([]);
  });

  it("rejects unsupported networks", async () => {
    const response = await handleApiRequest({
      request: new Request(`https://slotglass.test/api/inspect?network=testnet&program=${address(2)}`),
      requestId: "route-test",
      rpc: new FixtureRpc(),
    });
    expect(response.status).toBe(400);
  });

  it("returns a versioned report for a legacy loader program", async () => {
    const rpc = new FixtureRpc();
    const program = address(31);
    rpc.accounts.set(program, account({ bytes: Uint8Array.from([1, 2, 3, 4]), owner: LOADER_IDS.legacyV2 }));
    const response = await handleApiRequest({
      request: new Request(`https://slotglass.test/api/inspect?network=devnet&program=${program}`),
      requestId: "route-test",
      rpc,
    });
    const body = await response.json() as { schemaVersion: string; control: { state: string } };
    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe("slotglass.inspection.v1");
    expect(body.control.state).toBe("not-applicable");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("publishes an OpenAPI document", async () => {
    const response = await handleApiRequest({
      request: new Request("https://slotglass.test/api/openapi.json"),
      requestId: "route-test",
    });
    const body = await response.json() as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths).toHaveProperty("/api/inspect");
  });
});
