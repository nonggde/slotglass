import { describe, expect, it } from "vitest";
import { decodeBase58, encodeBase58, isSolanaAddress } from "../src/domain/base58";

describe("Base58 address validation", () => {
  it("round-trips a 32-byte public key", () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    expect(decodeBase58(encodeBase58(bytes))).toEqual(bytes);
  });

  it("accepts canonical known Solana addresses", () => {
    expect(isSolanaAddress("11111111111111111111111111111111")).toBe(true);
    expect(isSolanaAddress("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")).toBe(true);
  });

  it("rejects non-canonical, truncated, and invalid alphabet values", () => {
    expect(isSolanaAddress("0UP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")).toBe(false);
    expect(isSolanaAddress("JUP6LkbZbjS1jK")).toBe(false);
    expect(isSolanaAddress("1JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4")).toBe(false);
  });
});
