import { encodeBase58 } from "../src/domain/base58";
import type { RpcAccountInfo, RpcContext, SignatureInfo, SolanaRpc, TransactionInfo } from "../src/rpc/types";

export function address(byte: number): string {
  return encodeBase58(new Uint8Array(32).fill(byte));
}

export function upgradeableProgramBytes(programDataAddress: string): Uint8Array {
  const bytes = new Uint8Array(36);
  new DataView(bytes.buffer).setUint32(0, 2, true);
  const decoded = decodeAddress(programDataAddress);
  bytes.set(decoded, 4);
  return bytes;
}

function decodeAddress(value: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes: number[] = [0];
  for (const char of value) {
    let carry = alphabet.indexOf(char);
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let index = 0; index < value.length - 1 && value[index] === "1"; index += 1) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

export function programDataBytes(args: { slot: bigint; authority?: string; code?: Uint8Array }): Uint8Array {
  const code = args.code ?? Uint8Array.from([0x7f, 0x45, 0x4c, 0x46]);
  const bytes = new Uint8Array(45 + code.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 3, true);
  view.setBigUint64(4, args.slot, true);
  if (args.authority) {
    bytes[12] = 1;
    bytes.set(decodeAddress(args.authority), 13);
  }
  bytes.set(code, 45);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function account(args: {
  bytes: Uint8Array;
  owner: string;
  executable?: boolean;
}): RpcAccountInfo {
  return {
    data: [toBase64(args.bytes), "base64"],
    executable: args.executable ?? true,
    lamports: 1_000_000,
    owner: args.owner,
    rentEpoch: 0,
    space: args.bytes.length,
  };
}

export class FixtureRpc implements SolanaRpc {
  readonly calls: string[] = [];
  readonly accounts = new Map<string, RpcAccountInfo>();
  signatures: SignatureInfo[] = [];
  transactions: Array<TransactionInfo | null> = [];

  async getAccountInfo(value: string): Promise<RpcContext<RpcAccountInfo | null>> {
    this.calls.push(`account:${value}`);
    return { context: { slot: 321_654_987 }, value: this.accounts.get(value) ?? null };
  }

  async getSignaturesForAddress(value: string, limit: number): Promise<SignatureInfo[]> {
    this.calls.push(`signatures:${value}:${limit}`);
    return this.signatures.slice(0, limit);
  }

  async getTransactions(signatures: string[]): Promise<Array<TransactionInfo | null>> {
    this.calls.push(`transactions:${signatures.length}`);
    return this.transactions.slice(0, signatures.length);
  }
}
