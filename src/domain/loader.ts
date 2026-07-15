import { encodeBase58 } from "./base58";
import type { ControlState, EvidenceValue, LoaderKind } from "../shared/report";

export const LOADER_IDS = {
  upgradeable: "BPFLoaderUpgradeab1e11111111111111111111111",
  legacyV1: "BPFLoader1111111111111111111111111111111111",
  legacyV2: "BPFLoader2111111111111111111111111111111111",
  loaderV4: "LoaderV411111111111111111111111111111111111",
  native: "NativeLoader1111111111111111111111111111111",
} as const;

export interface UpgradeableProgramState {
  programDataAddress: string;
}

export interface ProgramDataState {
  deploymentSlot: string;
  upgradeAuthority: string | null;
  deployedBytes: Uint8Array;
}

export function loaderKindForOwner(owner: string): LoaderKind {
  if (owner === LOADER_IDS.upgradeable) return "upgradeable-bpf";
  if (owner === LOADER_IDS.legacyV1) return "legacy-bpf-v1";
  if (owner === LOADER_IDS.legacyV2) return "legacy-bpf-v2";
  if (owner === LOADER_IDS.loaderV4) return "loader-v4";
  if (owner === LOADER_IDS.native) return "native";
  return "unknown";
}

function readDiscriminator(data: Uint8Array): number {
  if (data.length < 4) throw new Error("Loader account data is shorter than its 4-byte state tag");
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
}

export function decodeUpgradeableProgram(data: Uint8Array): UpgradeableProgramState {
  if (data.length < 36) throw new Error("Upgradeable Program account is shorter than 36 bytes");
  if (readDiscriminator(data) !== 2) throw new Error("Account is not an UpgradeableLoader Program state");
  return { programDataAddress: encodeBase58(data.slice(4, 36)) };
}

export function decodeProgramData(data: Uint8Array): ProgramDataState {
  if (data.length < 45) throw new Error("ProgramData account is shorter than its 45-byte metadata region");
  if (readDiscriminator(data) !== 3) throw new Error("Account is not an UpgradeableLoader ProgramData state");

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const deploymentSlot = view.getBigUint64(4, true).toString();
  const authorityTag = data[12];
  if (authorityTag !== 0 && authorityTag !== 1) {
    throw new Error("ProgramData upgrade-authority option tag is invalid");
  }

  return {
    deploymentSlot,
    upgradeAuthority: authorityTag === 1 ? encodeBase58(data.slice(13, 45)) : null,
    deployedBytes: data.slice(45),
  };
}

export function controlEvidenceFromProgramData(state: ProgramDataState): {
  state: ControlState;
  upgradeAuthority: EvidenceValue<string>;
  deploymentSlot: EvidenceValue<string>;
} {
  return {
    state: state.upgradeAuthority ? "mutable" : "immutable",
    upgradeAuthority: {
      state: "known",
      value: state.upgradeAuthority,
      source: "UpgradeableLoader ProgramData metadata bytes 12..44",
    },
    deploymentSlot: {
      state: "known",
      value: state.deploymentSlot,
      source: "UpgradeableLoader ProgramData metadata bytes 4..11 (little-endian u64)",
    },
  };
}
