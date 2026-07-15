import { decodeBase58, isSolanaAddress } from "./base58";
import {
  controlEvidenceFromProgramData,
  decodeProgramData,
  decodeUpgradeableProgram,
  loaderKindForOwner,
  LOADER_IDS,
} from "./loader";
import type {
  ActivityEvent,
  ControlState,
  EvidenceValue,
  InspectionReport,
  Network,
  RiskSignal,
  VerdictLevel,
} from "../shared/report";
import type { SignatureInfo, SolanaRpc, TransactionInfo } from "../rpc/types";

export const SIGNATURE_LIMIT = 12;
export const TRANSACTION_LIMIT = 6;

export class InspectionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

function decodeBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new InspectionError(502, "INVALID_RPC_ACCOUNT_DATA", "Solana RPC returned malformed Base64 account data");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const ownedBuffer = Uint8Array.from(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", ownedBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unknownEvidence<T>(source: string): EvidenceValue<T> {
  return { state: "unknown", value: null, source };
}

function notApplicableEvidence<T>(source: string): EvidenceValue<T> {
  return { state: "not-applicable", value: null, source };
}

function explorerCluster(network: Network): string {
  return network === "devnet" ? "?cluster=devnet" : "";
}

function eventFromTransaction(
  signature: SignatureInfo,
  transaction: TransactionInfo,
  network: Network,
): ActivityEvent | null {
  const logs = transaction.meta?.logMessages ?? [];
  const joined = logs.join("\n").toLowerCase();
  let type: ActivityEvent["type"] | null = null;
  let evidence = "";

  if (joined.includes("instruction: upgrade")) {
    type = "upgrade";
    evidence = "Runtime log contains 'Instruction: Upgrade'.";
  } else if (joined.includes("instruction: setauthority") || joined.includes("instruction: set authority")) {
    type = "authority-change";
    evidence = "Runtime log contains an upgrade-authority instruction.";
  } else if (joined.includes("instruction: deploy")) {
    type = "deployment";
    evidence = "Runtime log contains 'Instruction: Deploy'.";
  } else if (joined.includes(LOADER_IDS.upgradeable.toLowerCase())) {
    type = "loader-activity";
    evidence = "Runtime logs invoke the Upgradeable BPF Loader, but the instruction name was not decoded.";
  }

  if (!type) return null;
  return {
    type,
    signature: signature.signature,
    slot: transaction.slot,
    blockTime: transaction.blockTime,
    succeeded: transaction.meta ? transaction.meta.err === null : null,
    evidence,
    explorerUrl: `https://explorer.solana.com/tx/${signature.signature}${explorerCluster(network)}`,
  };
}

function buildSignals(args: {
  executable: boolean;
  loaderKind: InspectionReport["identity"]["loaderKind"];
  controlState: ControlState;
  fingerprintKnown: boolean;
  events: ActivityEvent[];
  activityComplete: boolean;
}): { signals: RiskSignal[]; level: VerdictLevel; headline: string; summary: string } {
  const signals: RiskSignal[] = [];
  if (!args.executable) {
    signals.push({
      id: "program-not-executable",
      severity: "elevated",
      title: "Account is not executable",
      summary: "The inspected address does not currently present as an executable Solana program account.",
      evidencePaths: ["identity.executable"],
    });
  }

  if (args.loaderKind === "unknown" || args.loaderKind === "loader-v4" || args.loaderKind === "native") {
    signals.push({
      id: "loader-decoder-boundary",
      severity: "unknown",
      title: "Loader control model not decoded",
      summary: "Slotglass identified the owner but does not claim upgrade-authority semantics for this loader in the MVP.",
      evidencePaths: ["identity.owner", "identity.loaderKind", "control.state"],
    });
  } else if (args.controlState === "mutable") {
    signals.push({
      id: "upgrade-authority-present",
      severity: "watch",
      title: "Upgrade authority is active",
      summary: "A single authority can replace the deployed program bytes. This is a control-plane fact, not a vulnerability finding.",
      evidencePaths: ["control.state", "control.upgradeAuthority"],
    });
  } else if (args.controlState === "immutable") {
    signals.push({
      id: "upgrade-authority-revoked",
      severity: "info",
      title: "Upgrade authority is revoked",
      summary: "UpgradeableLoader metadata encodes no current upgrade authority.",
      evidencePaths: ["control.state", "control.upgradeAuthority"],
    });
  } else if (args.controlState === "not-applicable") {
    signals.push({
      id: "legacy-loader",
      severity: "info",
      title: "Legacy loader program",
      summary: "The program bytes live directly in the executable account and do not use UpgradeableLoader ProgramData control metadata.",
      evidencePaths: ["identity.loaderKind", "control.state"],
    });
  }

  if (args.fingerprintKnown) {
    signals.push({
      id: "code-fingerprint-recorded",
      severity: "info",
      title: "Deployed bytes fingerprinted",
      summary: "The report records a reproducible SHA-256 digest at the observation slot.",
      evidencePaths: ["fingerprint.digest", "fingerprint.byteLength", "fingerprint.observationSlot"],
    });
  } else {
    signals.push({
      id: "fingerprint-unavailable",
      severity: "unknown",
      title: "Code fingerprint unavailable",
      summary: "Slotglass did not identify a supported deployed-byte region for this account.",
      evidencePaths: ["fingerprint.state", "fingerprint.source"],
    });
  }

  const recentControlEvents = args.events.filter((event) => event.type === "upgrade" || event.type === "authority-change");
  if (recentControlEvents.length > 0) {
    signals.push({
      id: "recent-control-activity",
      severity: "watch",
      title: "Recent control-plane activity found",
      summary: `${recentControlEvents.length} bounded transaction record(s) include upgrade or authority-change evidence.`,
      evidencePaths: ["activity.events"],
    });
  }
  if (!args.activityComplete) {
    signals.push({
      id: "activity-window-incomplete",
      severity: "unknown",
      title: "Recent activity evidence is incomplete",
      summary: "The control state and fingerprint remain usable, but the bounded transaction window could not be fully reconstructed.",
      evidencePaths: ["activity", "evidenceGaps"],
    });
  }

  let level: VerdictLevel;
  let headline: string;
  let summary: string;
  if (!args.executable) {
    level = "elevated";
    headline = "Execution state requires attention";
    summary = "The address is not currently marked executable; verify that the intended program address was inspected.";
  } else if (!args.fingerprintKnown || args.controlState === "unknown") {
    level = "unknown";
    headline = "Control evidence is incomplete";
    summary = "Slotglass will not infer a favorable status when the loader's deployed bytes or authority model are outside the supported decoder.";
  } else if (args.controlState === "mutable" || recentControlEvents.length > 0) {
    level = "watch";
    headline = "Active control surface"
    summary = "The program is inspectable, but an upgrade authority or recent control event means deployed behavior can change.";
  } else {
    level = "low";
    headline = "No active upgrade authority detected";
    summary = args.activityComplete
      ? "The observed loader metadata is immutable and the bounded recent window adds no upgrade or authority-change evidence."
      : "The observed loader metadata is immutable; recent activity history is incomplete and should be checked separately.";
  }
  return { signals, level, headline, summary };
}

export async function inspectProgram(args: {
  program: string;
  network: Network;
  rpc: SolanaRpc;
  origin: string;
  requestId: string;
}): Promise<InspectionReport> {
  const startedAt = performance.now();
  const { program, network, rpc } = args;
  if (!isSolanaAddress(program)) {
    throw new InspectionError(400, "INVALID_PROGRAM_ADDRESS", "Program must be a canonical 32-byte Solana Base58 address");
  }

  const programResult = await rpc.getAccountInfo(program);
  if (!programResult.value) {
    throw new InspectionError(404, "ACCOUNT_NOT_FOUND", `No account was found for ${program} on ${network}`);
  }

  const programAccount = programResult.value;
  const programBytes = decodeBase64(programAccount.data[0]);
  const loaderKind = loaderKindForOwner(programAccount.owner);
  const evidenceGaps: string[] = [];
  let controlState: ControlState = "unknown";
  let programDataAddress = unknownEvidence<string>("ProgramData was not decoded");
  let upgradeAuthority = unknownEvidence<string>("Upgrade authority was not decoded");
  let deploymentSlot = unknownEvidence<string>("Deployment slot was not decoded");
  let deployedBytes: Uint8Array | null = null;
  let fingerprintSource = "No supported deployed-byte region was identified";

  if (loaderKind === "upgradeable-bpf") {
    try {
      const programState = decodeUpgradeableProgram(programBytes);
      programDataAddress = {
        state: "known",
        value: programState.programDataAddress,
        source: "UpgradeableLoader Program account bytes 4..35",
      };
      const programDataResult = await rpc.getAccountInfo(programState.programDataAddress);
      if (!programDataResult.value) throw new Error("Referenced ProgramData account was not found");
      if (programDataResult.value.owner !== LOADER_IDS.upgradeable) {
        throw new Error("Referenced ProgramData account has an unexpected owner");
      }
      const programData = decodeProgramData(decodeBase64(programDataResult.value.data[0]));
      const control = controlEvidenceFromProgramData(programData);
      controlState = control.state;
      upgradeAuthority = control.upgradeAuthority;
      deploymentSlot = control.deploymentSlot;
      deployedBytes = programData.deployedBytes;
      fingerprintSource = "UpgradeableLoader ProgramData bytes after the fixed 45-byte metadata region";
    } catch (error) {
      evidenceGaps.push(`ProgramData decode failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  } else if (loaderKind === "legacy-bpf-v1" || loaderKind === "legacy-bpf-v2") {
    controlState = "not-applicable";
    programDataAddress = notApplicableEvidence("Legacy BPF loaders store code in the executable program account");
    upgradeAuthority = notApplicableEvidence("Legacy BPF loader account has no UpgradeableLoader authority field");
    deploymentSlot = notApplicableEvidence("Legacy loader account data does not encode a deployment slot");
    deployedBytes = programBytes;
    fingerprintSource = "Executable program account data owned by a legacy BPF loader";
  } else {
    evidenceGaps.push(`Loader '${loaderKind}' is identified but its control metadata and code region are outside the MVP decoder`);
  }

  const digest = deployedBytes ? await sha256Hex(deployedBytes) : null;
  const activityTarget = programDataAddress.value ?? program;
  let signatures: SignatureInfo[] = [];
  let transactions: Array<TransactionInfo | null> = [];
  let events: ActivityEvent[] = [];
  let activityComplete = true;
  try {
    signatures = await rpc.getSignaturesForAddress(activityTarget, SIGNATURE_LIMIT);
    const selectedSignatures = signatures.slice(0, TRANSACTION_LIMIT);
    transactions = await rpc.getTransactions(selectedSignatures.map((item) => item.signature));
    events = selectedSignatures.flatMap((signature, index) => {
      const transaction = transactions[index];
      if (!transaction) return [];
      const event = eventFromTransaction(signature, transaction, network);
      return event ? [event] : [];
    });
    if (transactions.some((transaction) => transaction === null)) {
      activityComplete = false;
      evidenceGaps.push("One or more bounded transaction records were unavailable from the RPC node");
    }
  } catch (error) {
    activityComplete = false;
    evidenceGaps.push(`Recent activity lookup failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const risk = buildSignals({
    executable: programAccount.executable,
    loaderKind,
    controlState,
    fingerprintKnown: digest !== null,
    events,
    activityComplete,
  });
  const apiUrl = `${args.origin}/api/inspect?network=${encodeURIComponent(network)}&program=${encodeURIComponent(program)}`;

  return {
    schemaVersion: "slotglass.inspection.v1",
    request: { program, network, commitment: "confirmed" },
    status: evidenceGaps.length === 0 ? "complete" : "partial",
    observedAt: new Date().toISOString(),
    observationSlot: programResult.context.slot,
    identity: {
      programAddress: program,
      network,
      owner: programAccount.owner,
      loaderKind,
      executable: programAccount.executable,
      lamports: programAccount.lamports,
      accountDataBytes: programBytes.byteLength,
      explorerUrl: `https://explorer.solana.com/address/${program}${explorerCluster(network)}`,
    },
    control: {
      state: controlState,
      programDataAddress,
      upgradeAuthority,
      deploymentSlot,
    },
    fingerprint: {
      state: digest ? "known" : "unknown",
      algorithm: "SHA-256",
      digest,
      byteLength: deployedBytes?.byteLength ?? null,
      source: fingerprintSource,
      observationSlot: programResult.context.slot,
    },
    activity: {
      targetAddress: activityTarget,
      scannedSignatures: signatures.length,
      scannedTransactions: transactions.length,
      signatureLimit: SIGNATURE_LIMIT,
      transactionLimit: TRANSACTION_LIMIT,
      events,
    },
    verdict: { level: risk.level, headline: risk.headline, summary: risk.summary },
    signals: risk.signals,
    evidenceGaps,
    reproducibility: {
      apiUrl,
      rpcMethods: ["getAccountInfo", "getSignaturesForAddress", "getTransaction"],
      classifierVersion: "2026-07-15.1",
    },
    meta: {
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      requestId: args.requestId,
    },
  };
}
