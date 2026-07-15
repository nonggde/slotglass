export const NETWORKS = ["mainnet-beta", "devnet"] as const;
export type Network = (typeof NETWORKS)[number];

export type LoaderKind =
  | "upgradeable-bpf"
  | "legacy-bpf-v1"
  | "legacy-bpf-v2"
  | "loader-v4"
  | "native"
  | "unknown";

export type EvidenceState = "known" | "unknown" | "not-applicable";
export type ControlState = "mutable" | "immutable" | "not-applicable" | "unknown";
export type Severity = "info" | "watch" | "elevated" | "unknown";
export type VerdictLevel = "low" | "watch" | "elevated" | "unknown";

export interface EvidenceValue<T> {
  state: EvidenceState;
  value: T | null;
  source: string;
}

export interface ActivityEvent {
  type: "deployment" | "upgrade" | "authority-change" | "loader-activity";
  signature: string;
  slot: number;
  blockTime: number | null;
  succeeded: boolean | null;
  evidence: string;
  explorerUrl: string;
}

export interface RiskSignal {
  id: string;
  severity: Severity;
  title: string;
  summary: string;
  evidencePaths: string[];
}

export interface InspectionReport {
  schemaVersion: "slotglass.inspection.v1";
  request: {
    program: string;
    network: Network;
    commitment: "confirmed";
  };
  status: "complete" | "partial";
  observedAt: string;
  observationSlot: number;
  identity: {
    programAddress: string;
    network: Network;
    owner: string;
    loaderKind: LoaderKind;
    executable: boolean;
    lamports: number;
    accountDataBytes: number;
    explorerUrl: string;
  };
  control: {
    state: ControlState;
    programDataAddress: EvidenceValue<string>;
    upgradeAuthority: EvidenceValue<string>;
    deploymentSlot: EvidenceValue<string>;
  };
  fingerprint: {
    state: EvidenceState;
    algorithm: "SHA-256";
    digest: string | null;
    byteLength: number | null;
    source: string;
    observationSlot: number;
  };
  activity: {
    targetAddress: string;
    scannedSignatures: number;
    scannedTransactions: number;
    signatureLimit: number;
    transactionLimit: number;
    events: ActivityEvent[];
  };
  verdict: {
    level: VerdictLevel;
    headline: string;
    summary: string;
  };
  signals: RiskSignal[];
  evidenceGaps: string[];
  reproducibility: {
    apiUrl: string;
    rpcMethods: string[];
    classifierVersion: "2026-07-15.1";
  };
  meta: {
    durationMs: number;
    requestId: string;
  };
}

export interface ApiError {
  schemaVersion: "slotglass.error.v1";
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: string[];
  };
}
