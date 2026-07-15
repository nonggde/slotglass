import type { Network } from "../shared/report";
import type { RpcAccountInfo, RpcContext, SignatureInfo, SolanaRpc, TransactionInfo } from "./types";

const RPC_ENDPOINTS: Record<Network, readonly string[]> = {
  "mainnet-beta": ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"],
  devnet: ["https://solana-devnet.api.onfinality.io/public", "https://api.devnet.solana.com"],
};

const MAX_RPC_RESPONSE_BYTES = 16 * 1024 * 1024;
const RPC_TIMEOUT_MS = 8_000;

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class UpstreamRpcError extends Error {
  constructor(
    message: string,
    readonly code = "RPC_UPSTREAM_ERROR",
  ) {
    super(message);
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RPC_RESPONSE_BYTES) {
    throw new UpstreamRpcError("Solana RPC response exceeded the 16 MiB inspection limit", "RPC_RESPONSE_TOO_LARGE");
  }
  if (!response.body) throw new UpstreamRpcError("Solana RPC returned an empty response body");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RPC_RESPONSE_BYTES) {
        await reader.cancel("response limit exceeded");
        throw new UpstreamRpcError("Solana RPC response exceeded the 16 MiB inspection limit", "RPC_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new UpstreamRpcError("Solana RPC returned invalid JSON");
  }
}

function validateRpcEnvelope<T>(value: unknown, expectedId: number): T {
  if (!value || typeof value !== "object") throw new UpstreamRpcError("Solana RPC returned an invalid envelope");
  const envelope = value as Partial<JsonRpcResponse<T>>;
  if (envelope.id !== expectedId) throw new UpstreamRpcError("Solana RPC response ID did not match the request");
  if (envelope.error) {
    throw new UpstreamRpcError(`Solana RPC ${envelope.error.code}: ${envelope.error.message}`);
  }
  if (!("result" in envelope)) throw new UpstreamRpcError("Solana RPC response did not include a result");
  return envelope.result as T;
}

export class PublicSolanaRpc implements SolanaRpc {
  readonly endpoints: readonly string[];

  constructor(network: Network) {
    this.endpoints = RPC_ENDPOINTS[network];
  }

  private async postToEndpoint(endpoint: string, payload: object | object[]): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": "slotglass/0.1",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new UpstreamRpcError(`Solana RPC returned HTTP ${response.status}`, "RPC_HTTP_ERROR");
      }
      return await readBoundedJson(response);
    } catch (error) {
      if (error instanceof UpstreamRpcError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new UpstreamRpcError("Solana RPC timed out after 8 seconds", "RPC_TIMEOUT");
      }
      throw new UpstreamRpcError(error instanceof Error ? error.message : "Solana RPC request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post(payload: object | object[]): Promise<unknown> {
    const failures: string[] = [];
    for (const endpoint of this.endpoints) {
      try {
        return await this.postToEndpoint(endpoint, payload);
      } catch (error) {
        if (!(error instanceof UpstreamRpcError)) throw error;
        failures.push(`${new URL(endpoint).hostname}: ${error.message}`);
      }
    }
    throw new UpstreamRpcError(`All fixed Solana RPC endpoints failed (${failures.join("; ")})`, "RPC_ENDPOINTS_EXHAUSTED");
  }

  private async call<T>(method: string, params: unknown[], id = 1): Promise<T> {
    const json = await this.post({ jsonrpc: "2.0", id, method, params });
    return validateRpcEnvelope<T>(json, id);
  }

  async getAccountInfo(address: string): Promise<RpcContext<RpcAccountInfo | null>> {
    return await this.call<RpcContext<RpcAccountInfo | null>>("getAccountInfo", [
      address,
      { encoding: "base64", commitment: "confirmed" },
    ]);
  }

  async getSignaturesForAddress(address: string, limit: number): Promise<SignatureInfo[]> {
    return await this.call<SignatureInfo[]>("getSignaturesForAddress", [
      address,
      { limit, commitment: "confirmed" },
    ]);
  }

  async getTransactions(signatures: string[]): Promise<Array<TransactionInfo | null>> {
    if (signatures.length === 0) return [];
    const payloads = signatures.map((signature, index) => ({
      jsonrpc: "2.0" as const,
      id: index + 1,
      method: "getTransaction",
      params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
    }));
    const json = await this.post(payloads);
    if (!Array.isArray(json)) throw new UpstreamRpcError("Solana RPC batch response was not an array");

    const byId = new Map<number, unknown>();
    for (const item of json) {
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "number") {
        byId.set((item as { id: number }).id, item);
      }
    }
    return signatures.map((_, index) => validateRpcEnvelope<TransactionInfo | null>(byId.get(index + 1), index + 1));
  }
}
