import { apiCacheKey, handleApiRequest } from "./api";

const DOCUMENT_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "),
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

function withDocumentSecurity(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(DOCUMENT_HEADERS)) secured.headers.set(name, value);
  return secured;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return withDocumentSecurity(await env.ASSETS.fetch(request));
    }

    const requestId = crypto.randomUUID();
    const isCacheableInspection = request.method === "GET" && url.pathname === "/api/inspect";
    if (isCacheableInspection) {
      const cacheKey = apiCacheKey(url);
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        const hit = new Response(cached.body, cached);
        hit.headers.set("x-slotglass-cache", "hit");
        return hit;
      }

      const response = await handleApiRequest({ request, requestId });
      response.headers.set("x-slotglass-cache", "miss");
      if (response.ok) ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    }

    return await handleApiRequest({ request, requestId });
  },
} satisfies ExportedHandler<Env>;
