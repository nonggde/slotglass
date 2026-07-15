import { inspectProgram, InspectionError } from "./domain/inspect";
import { PublicSolanaRpc, UpstreamRpcError } from "./rpc/client";
import type { SolanaRpc } from "./rpc/types";
import { NETWORKS, type ApiError, type Network } from "./shared/report";
import { openApiDocument } from "./openapi";

const API_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
} as const;

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value, null, 2), {
    ...init,
    headers: { ...API_HEADERS, ...init.headers },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: string[],
): Response {
  const body: ApiError = {
    schemaVersion: "slotglass.error.v1",
    error: { code, message, requestId, ...(details ? { details } : {}) },
  };
  return json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function handleApiRequest(args: {
  request: Request;
  requestId: string;
  rpc?: SolanaRpc;
}): Promise<Response> {
  const { request, requestId } = args;
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: API_HEADERS });
  if (request.method !== "GET") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Only GET is supported for this endpoint", requestId);
  }

  if (url.pathname === "/api/health") {
    return json({ ok: true, service: "slotglass", schemaVersion: "slotglass.health.v1" }, {
      headers: { "cache-control": "public, max-age=30" },
    });
  }
  if (url.pathname === "/api/openapi.json") {
    return json(openApiDocument, { headers: { "cache-control": "public, max-age=3600" } });
  }
  if (url.pathname !== "/api/inspect") {
    return errorResponse(404, "ROUTE_NOT_FOUND", "API route not found", requestId);
  }

  const program = (url.searchParams.get("program") ?? "").trim();
  const requestedNetwork = url.searchParams.get("network") ?? "mainnet-beta";
  if (!NETWORKS.includes(requestedNetwork as Network)) {
    return errorResponse(
      400,
      "INVALID_NETWORK",
      "Network must be mainnet-beta or devnet",
      requestId,
      ["Supported networks: mainnet-beta, devnet"],
    );
  }
  const network = requestedNetwork as Network;

  try {
    const report = await inspectProgram({
      program,
      network,
      rpc: args.rpc ?? new PublicSolanaRpc(network),
      origin: url.origin,
      requestId,
    });
    return json(report, {
      headers: {
        "cache-control": "public, max-age=20, s-maxage=45, stale-while-revalidate=30",
        "cdn-cache-control": "max-age=45",
      },
    });
  } catch (error) {
    if (error instanceof InspectionError) {
      return errorResponse(error.status, error.code, error.message, requestId, error.details);
    }
    if (error instanceof UpstreamRpcError) {
      console.error(JSON.stringify({ message: "rpc evidence failed", error: error.message, code: error.code, requestId, network, program }));
      return errorResponse(502, error.code, error.message, requestId);
    }
    console.error(JSON.stringify({
      message: "inspection failed",
      error: error instanceof Error ? error.message : String(error),
      requestId,
      network,
      program,
    }));
    return errorResponse(
      502,
      "INSPECTION_FAILED",
      "Inspection evidence could not be completed",
      requestId,
      [error instanceof Error ? error.message : "Unknown inspection error"],
    );
  }
}

export function apiCacheKey(url: URL): Request {
  const normalized = new URL("/api/inspect", url.origin);
  normalized.searchParams.set("network", url.searchParams.get("network") ?? "mainnet-beta");
  normalized.searchParams.set("program", (url.searchParams.get("program") ?? "").trim());
  return new Request(normalized.toString(), { method: "GET" });
}
