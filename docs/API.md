# Slotglass API

## Inspect a program

`GET /api/inspect?network=<network>&program=<address>`

`network` is `mainnet-beta` or `devnet`. `program` must be the canonical Base58 encoding of exactly 32 bytes. Invalid input returns before any upstream request.

The success body uses `slotglass.inspection.v1` and contains:

| Field | Meaning |
| --- | --- |
| `status` | `complete` when every attempted evidence source completed, otherwise `partial` |
| `observationSlot` | Context slot returned with the program account |
| `identity` | Address, network, owner, loader classification, executable state, and account size |
| `control` | ProgramData, authority, and deployment slot with a state and source for each value |
| `fingerprint` | SHA-256 and length of the supported deployed-byte region |
| `activity` | Named loader events from the bounded signature/transaction window |
| `signals` | Deterministic rules with JSON evidence paths |
| `evidenceGaps` | RPC, decoding, or support boundaries that prevented a complete claim |
| `reproducibility` | Canonical API URL, RPC methods, and classifier version |

All u64 slots encoded in account data are returned as decimal strings. This preserves values beyond JavaScript's safe integer range.

## Evidence value states

- `known`: the decoder determined the field. A known `null` upgrade authority means no authority is encoded.
- `unknown`: the source was missing, malformed, or outside the supported decoder.
- `not-applicable`: the loader model does not have that UpgradeableLoader field.

## Activity window

The engine asks for at most 12 signatures and decodes at most 6 transactions. It recognizes named `Upgrade`, `SetAuthority`, and `Deploy` runtime logs. The result does not claim complete program history.

## Errors

Errors use `slotglass.error.v1`:

```json
{
  "schemaVersion": "slotglass.error.v1",
  "error": {
    "code": "INVALID_PROGRAM_ADDRESS",
    "message": "Program must be a canonical 32-byte Solana Base58 address",
    "requestId": "..."
  }
}
```

Expected status codes are `400` for validation, `404` for a missing account, `405` for unsupported methods, and `502` for malformed or unavailable RPC evidence.
