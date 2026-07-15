# Slotglass

Slotglass creates a reproducible control-plane risk passport for a Solana program address. It reports what the selected RPC node actually returned, separates deterministic signals from facts, and keeps unsupported states visible as unknown.

**Live:** https://slotglass.a13553776411.workers.dev

## What the MVP inspects

- mainnet-beta and devnet program accounts;
- account owner, loader family, and executable state;
- UpgradeableLoader ProgramData address, deployment slot, and upgrade authority;
- SHA-256 of the supported deployed-byte region;
- up to 12 recent signatures and 6 decoded transactions for named loader activity;
- evidence gaps and deterministic risk signals;
- the same versioned report in the responsive UI and JSON API.

Slotglass does not decompile sBPF, prove source equivalence, continuously monitor programs, audit business logic, or certify security.

## Local development

Requirements: Node.js 20 or newer and a network connection to the public Solana RPC endpoints.

```bash
npm install
npm run dev:worker
```

Open `http://localhost:8787`. For split frontend development, run `npm run dev:worker` and `npm run dev` in separate terminals; Vite proxies `/api` to the Worker.

## Verification

```bash
npm run typecheck
npm run test
npm run build
npx wrangler deploy --dry-run
```

The fixture suite covers canonical Base58 validation, mutable and immutable ProgramData states, u64 deployment slots beyond JavaScript's safe integer range, malformed loader data, bounded upgrade evidence, legacy loaders, and route validation before any RPC request.

## API

```bash
curl "https://slotglass.a13553776411.workers.dev/api/inspect?network=mainnet-beta&program=JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
```

- Schema: `slotglass.inspection.v1`
- OpenAPI: `/api/openapi.json`
- Health: `/api/health`
- Commitment: `confirmed`
- Supported networks: `mainnet-beta`, `devnet`

See [docs/API.md](docs/API.md) for field semantics and error behavior.

## Evidence boundaries

The Worker accepts only a canonical 32-byte Base58 address and one of two fixed networks. Clients cannot choose an upstream URL. Upstream calls use explicit timeouts, a 16 MiB response cap, fixed RPC methods, and bounded history fan-out. Successful public reports are cached briefly at the edge.

Upgrade authority is a control-plane property, not a vulnerability. An immutable result only describes the loader metadata observed at one confirmed slot. A quiet bounded activity window is not the same as proving that no historical upgrade ever occurred.

## Architecture

```text
Browser
  -> Cloudflare Worker /api/inspect
      -> fixed Solana JSON-RPC endpoint
          -> getAccountInfo(program)
          -> getAccountInfo(ProgramData), when applicable
          -> getSignaturesForAddress(target, limit 12)
          -> getTransaction batch, limit 6
      -> loader decoder + SHA-256 + deterministic classifier
  <- slotglass.inspection.v1
```

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

## References

- [Solana getAccountInfo](https://solana.com/docs/rpc/http/getaccountinfo)
- [Solana getSignaturesForAddress](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare static asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/)

## License

Apache-2.0
