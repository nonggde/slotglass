export interface RpcContext<T> {
  context: { slot: number; apiVersion?: string };
  value: T;
}

export interface RpcAccountInfo {
  data: [string, "base64"];
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  space: number;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown | null;
  memo: string | null;
}

export interface TransactionInfo {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown | null;
    logMessages: string[] | null;
  } | null;
}

export interface SolanaRpc {
  getAccountInfo(address: string): Promise<RpcContext<RpcAccountInfo | null>>;
  getSignaturesForAddress(address: string, limit: number): Promise<SignatureInfo[]>;
  getTransactions(signatures: string[]): Promise<Array<TransactionInfo | null>>;
}
