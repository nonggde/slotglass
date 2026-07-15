export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Slotglass Inspection API",
    version: "1.0.0",
    description:
      "Evidence-backed Solana program control-plane inspection. Results are observations, not security certifications.",
  },
  paths: {
    "/api/inspect": {
      get: {
        summary: "Inspect a Solana program account",
        parameters: [
          {
            name: "network",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["mainnet-beta", "devnet"] },
          },
          {
            name: "program",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 32, maxLength: 44 },
          },
        ],
        responses: {
          "200": {
            description: "Versioned inspection report",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InspectionReport" },
              },
            },
          },
          "400": { description: "Invalid network or program address" },
          "404": { description: "Account not found" },
          "502": { description: "Malformed or unavailable upstream RPC evidence" },
        },
      },
    },
    "/api/health": {
      get: { summary: "Service health", responses: { "200": { description: "Healthy" } } },
    },
  },
  components: {
    schemas: {
      InspectionReport: {
        type: "object",
        required: [
          "schemaVersion",
          "request",
          "status",
          "observedAt",
          "observationSlot",
          "identity",
          "control",
          "fingerprint",
          "activity",
          "verdict",
          "signals",
          "evidenceGaps",
          "reproducibility",
          "meta",
        ],
        properties: {
          schemaVersion: { const: "slotglass.inspection.v1" },
          status: { type: "string", enum: ["complete", "partial"] },
          observedAt: { type: "string", format: "date-time" },
          observationSlot: { type: "integer" },
          identity: { type: "object" },
          control: { type: "object" },
          fingerprint: { type: "object" },
          activity: { type: "object" },
          verdict: { type: "object" },
          signals: { type: "array", items: { type: "object" } },
          evidenceGaps: { type: "array", items: { type: "string" } },
          reproducibility: { type: "object" },
          meta: { type: "object" },
        },
      },
    },
  },
} as const;
