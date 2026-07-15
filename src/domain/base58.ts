const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP = new Map(Array.from(ALPHABET, (char, index) => [char, index]));

export function decodeBase58(value: string): Uint8Array {
  if (value.length === 0) return new Uint8Array();

  const bytes: number[] = [0];
  for (const char of value) {
    const digit = ALPHABET_MAP.get(char);
    if (digit === undefined) throw new Error("Address contains a non-Base58 character");

    let carry = digit;
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

  for (let index = 0; index < value.length - 1 && value[index] === "1"; index += 1) {
    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
}

export function encodeBase58(value: Uint8Array): string {
  if (value.length === 0) return "";

  const digits: number[] = [0];
  for (const byte of value) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let result = "";
  for (let index = 0; index < value.length - 1 && value[index] === 0; index += 1) {
    result += "1";
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    result += ALPHABET[digits[index]];
  }
  return result;
}

export function isSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false;
  try {
    const decoded = decodeBase58(value);
    return decoded.length === 32 && encodeBase58(decoded) === value;
  } catch {
    return false;
  }
}
