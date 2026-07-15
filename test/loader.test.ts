import { describe, expect, it } from "vitest";
import { decodeProgramData, decodeUpgradeableProgram } from "../src/domain/loader";
import { address, programDataBytes, upgradeableProgramBytes } from "./fixtures";

describe("UpgradeableLoader decoding", () => {
  it("decodes the ProgramData address from Program state", () => {
    const programData = address(7);
    expect(decodeUpgradeableProgram(upgradeableProgramBytes(programData))).toEqual({ programDataAddress: programData });
  });

  it("decodes mutable ProgramData metadata and isolates deployed bytes", () => {
    const authority = address(9);
    const code = Uint8Array.from([1, 3, 3, 7]);
    const decoded = decodeProgramData(programDataBytes({ slot: 9_007_199_254_740_993n, authority, code }));
    expect(decoded.deploymentSlot).toBe("9007199254740993");
    expect(decoded.upgradeAuthority).toBe(authority);
    expect(decoded.deployedBytes).toEqual(code);
  });

  it("preserves explicit immutability", () => {
    const decoded = decodeProgramData(programDataBytes({ slot: 42n }));
    expect(decoded.upgradeAuthority).toBeNull();
    expect(decoded.deploymentSlot).toBe("42");
  });

  it("rejects malformed state tags and short metadata", () => {
    expect(() => decodeProgramData(new Uint8Array(44))).toThrow("shorter");
    const bytes = programDataBytes({ slot: 1n });
    bytes[0] = 2;
    expect(() => decodeProgramData(bytes)).toThrow("not an UpgradeableLoader ProgramData");
  });
});
