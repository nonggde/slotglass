# Reproducible inspection examples

Slotglass reports a time-bounded RPC observation. Re-running an example can produce a later observation slot, newer activity or a temporary evidence gap. Compare the report structure and evidence state rather than expecting byte-for-byte identical JSON.

## Complete immutable example

The SPL Token Program currently provides a compact example of the supported UpgradeableLoader path:

```bash
curl "https://slotglass.a13553776411.workers.dev/api/inspect?network=mainnet-beta&program=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
```

At the time this example was added, the report returned:

```text
schemaVersion: slotglass.inspection.v1
status: complete
identity.loaderKind: upgradeable-bpf
control.state: immutable
fingerprint.state: known
verdict.level: low
evidenceGaps: []
```

The exact fingerprint and observation slot are evidence values. Read them from the current response rather than pinning the values in this document.

## Partial-evidence example

Jupiter v6 demonstrates why an inspection result must preserve upstream limitations:

```bash
curl "https://slotglass.a13553776411.workers.dev/api/inspect?network=mainnet-beta&program=JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
```

If a public RPC provider rate-limits the ProgramData or activity request, Slotglass returns `status: partial`, leaves unsupported conclusions unknown and lists the upstream failures in `evidenceGaps`. A later request may complete when the provider recovers.

## Invalid-input example

The API validates the network and canonical 32-byte Base58 address before making an RPC request:

```bash
curl -i "https://slotglass.a13553776411.workers.dev/api/inspect?network=mainnet-beta&program=not-a-program"
```

The route returns a structured 400 response. The client cannot supply an arbitrary upstream RPC URL.

## Local reproduction

```bash
npm install
npm run dev:worker
curl "http://localhost:8787/api/inspect?network=mainnet-beta&program=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
```

The public endpoint uses `confirmed` commitment. See [API.md](API.md) for field semantics and [SECURITY.md](SECURITY.md) for trust boundaries.
