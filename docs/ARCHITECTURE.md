# Architecture

## Boundaries

`src/domain` contains deterministic parsing and classification. It has no dependency on Cloudflare bindings. `src/rpc` owns the two fixed public endpoints, JSON-RPC envelopes, timeouts, response limits, and the bounded transaction batch. `src/api.ts` performs HTTP validation and produces versioned JSON. `src/worker.ts` adds edge caching, static asset delivery, and production security headers. `web` renders the report without reimplementing any risk rule.

The `SolanaRpc` interface is the test boundary. Fixture tests substitute complete and partial RPC states without relying on a live validator.

## UpgradeableLoader decoding

The executable Program state is expected to contain a 4-byte little-endian state tag followed by the 32-byte ProgramData address. ProgramData uses a 45-byte fixed metadata region for the state tag, deployment slot, optional authority, and reserved authority bytes. Slotglass fingerprints bytes after that region.

Before decoding ProgramData, the Worker verifies that the referenced account exists and is owned by the Upgradeable BPF Loader. Any mismatch becomes an evidence gap and an unknown control result.

Legacy BPF loader programs store executable bytes directly in the program account. Loader v4, native programs, and unrecognized owners are identified but intentionally remain outside the MVP control decoder.

## Deterministic classification

The classifier has no model call and no probabilistic output. Current precedence is:

1. non-executable account: `elevated`;
2. unsupported control model or missing fingerprint: `unknown`;
3. active upgrade authority or recent named control event: `watch`;
4. supported immutable or legacy state with a fingerprint: `low`.

An activity lookup failure adds a visible unknown signal. It does not erase independently decoded control metadata or byte fingerprints.

## Caching

Only successful `GET /api/inspect` responses are cached. The canonical cache key contains the normalized network and trimmed program address. Browser freshness is 20 seconds; edge freshness is 45 seconds with a short stale-while-revalidate window. Errors are never cached.
