import { describe, expect, it } from "vitest";
import { inspectProgram } from "../src/domain/inspect";
import { LOADER_IDS } from "../src/domain/loader";
import { account, address, FixtureRpc, programDataBytes, upgradeableProgramBytes } from "./fixtures";

describe("inspection evidence engine", () => {
  it("produces a mutable report with fingerprint and named upgrade activity", async () => {
    const rpc = new FixtureRpc();
    const program = address(3);
    const programData = address(4);
    const authority = address(5);
    rpc.accounts.set(program, account({ bytes: upgradeableProgramBytes(programData), owner: LOADER_IDS.upgradeable }));
    rpc.accounts.set(programData, account({
      bytes: programDataBytes({ slot: 123_456n, authority, code: Uint8Array.from([1, 2, 3]) }),
      owner: LOADER_IDS.upgradeable,
      executable: false,
    }));
    rpc.signatures = [{ signature: address(6), slot: 123_999, blockTime: 1_700_000_000, err: null, memo: null }];
    rpc.transactions = [{
      slot: 123_999,
      blockTime: 1_700_000_000,
      meta: { err: null, logMessages: ["Program log: Instruction: Upgrade"] },
    }];

    const report = await inspectProgram({ program, network: "mainnet-beta", rpc, origin: "https://slotglass.test", requestId: "test" });
    expect(report.status).toBe("complete");
    expect(report.control.state).toBe("mutable");
    expect(report.control.upgradeAuthority.value).toBe(authority);
    expect(report.control.deploymentSlot.value).toBe("123456");
    expect(report.fingerprint.digest).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
    expect(report.activity.events[0].type).toBe("upgrade");
    expect(report.verdict.level).toBe("watch");
  });

  it("reports immutable metadata as low without inventing an authority", async () => {
    const rpc = new FixtureRpc();
    const program = address(11);
    const programData = address(12);
    rpc.accounts.set(program, account({ bytes: upgradeableProgramBytes(programData), owner: LOADER_IDS.upgradeable }));
    rpc.accounts.set(programData, account({ bytes: programDataBytes({ slot: 777n }), owner: LOADER_IDS.upgradeable, executable: false }));

    const report = await inspectProgram({ program, network: "devnet", rpc, origin: "https://slotglass.test", requestId: "test" });
    expect(report.control.state).toBe("immutable");
    expect(report.control.upgradeAuthority).toMatchObject({ state: "known", value: null });
    expect(report.verdict.level).toBe("low");
    expect(report.identity.explorerUrl).toContain("cluster=devnet");
  });

  it("keeps malformed ProgramData visible as partial unknown evidence", async () => {
    const rpc = new FixtureRpc();
    const program = address(20);
    const programData = address(21);
    rpc.accounts.set(program, account({ bytes: upgradeableProgramBytes(programData), owner: LOADER_IDS.upgradeable }));
    rpc.accounts.set(programData, account({ bytes: new Uint8Array(8), owner: LOADER_IDS.upgradeable, executable: false }));

    const report = await inspectProgram({ program, network: "mainnet-beta", rpc, origin: "https://slotglass.test", requestId: "test" });
    expect(report.status).toBe("partial");
    expect(report.control.state).toBe("unknown");
    expect(report.fingerprint.state).toBe("unknown");
    expect(report.evidenceGaps[0]).toContain("ProgramData decode failed");
    expect(report.verdict.level).toBe("unknown");
  });
});
