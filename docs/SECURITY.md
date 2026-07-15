# Security and trust boundaries

## Input and upstream controls

- Only canonical 32-byte Base58 program addresses are accepted.
- Network is allowlisted to mainnet-beta and devnet.
- RPC endpoints and method names are fixed in source; there is no arbitrary proxy URL.
- Each RPC request has an 8-second timeout.
- A streamed response reader rejects bodies above 16 MiB before JSON parsing.
- Signature and transaction lookups are capped at 12 and 6 respectively.
- The browser never receives or supplies an RPC secret.

## Response behavior

- API errors are structured and do not expose stack traces.
- Static documents receive CSP, frame, MIME, referrer, and permissions headers.
- API responses use `nosniff`, frame denial, and explicit CORS for public read-only evidence.
- Only successful reports enter the edge cache.
- Worker logs are structured and include request IDs without storing request state globally.

## Non-claims

Slotglass is not a smart-contract audit, verified-build service, source-code equivalence proof, malware detector, or continuous monitor. A SHA-256 digest identifies bytes at one observation slot; it does not establish that those bytes are safe. Loader metadata can be misunderstood if a future loader changes layout, so unsupported loaders remain explicit unknowns until separately implemented and tested.

## Reporting issues

Open a GitHub issue with the program address, network, observation time, request ID, expected evidence, and actual evidence. Do not include private keys, seed phrases, RPC secrets, or other credentials.
