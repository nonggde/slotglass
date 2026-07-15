import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Fingerprint,
  Gauge,
  Github,
  KeyRound,
  LoaderCircle,
  Network,
  Search,
  ShieldCheck,
  TerminalSquare,
  X,
} from "lucide-react";
import type {
  ActivityEvent,
  EvidenceValue,
  InspectionReport,
  Network as SolanaNetwork,
  RiskSignal,
} from "../../src/shared/report";

const EXAMPLES = [
  { label: "Jupiter v6", address: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", network: "mainnet-beta" },
  { label: "SPL Token", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", network: "mainnet-beta" },
] as const;

type ViewMode = "report" | "json";

interface RequestError {
  code: string;
  message: string;
  requestId?: string;
}

function shorten(value: string, start = 7, end = 7): string {
  return value.length > start + end + 3 ? `${value.slice(0, start)}...${value.slice(-end)}` : value;
}

function formatDate(value: string | number | null): string {
  if (value === null) return "Unavailable";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function titleCase(value: string): string {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function CopyButton({ value, label = "Copy value" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }
  return (
    <button className="icon-button" type="button" onClick={copy} aria-label={label} title={label}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

function EvidenceRow<T>({ label, evidence }: { label: string; evidence: EvidenceValue<T> }) {
  const display = evidence.state === "not-applicable"
    ? "Not applicable"
    : evidence.value === null
      ? evidence.state === "known" ? "None encoded" : "Unknown"
      : String(evidence.value);
  return (
    <div className="evidence-row">
      <div>
        <span className="field-label">{label}</span>
        <span className={`evidence-state state-${evidence.state}`}>{evidence.state}</span>
      </div>
      <div className="value-line">
        <code title={display}>{display}</code>
        {evidence.value !== null && <CopyButton value={String(evidence.value)} label={`Copy ${label}`} />}
      </div>
      <p>{evidence.source}</p>
    </div>
  );
}

function SectionHeader({ icon, index, title, meta }: { icon: ReactNode; index: string; title: string; meta?: string }) {
  return (
    <header className="section-header">
      <span className="section-index">{index}</span>
      <span className="section-icon">{icon}</span>
      <h2>{title}</h2>
      {meta && <span className="section-meta">{meta}</span>}
    </header>
  );
}

function Signal({ signal }: { signal: RiskSignal }) {
  const Icon = signal.severity === "elevated" || signal.severity === "watch"
    ? AlertTriangle
    : signal.severity === "unknown" ? CircleDot : ShieldCheck;
  return (
    <article className={`signal signal-${signal.severity}`}>
      <div className="signal-mark"><Icon size={17} /></div>
      <div className="signal-body">
        <div className="signal-title-line">
          <h3>{signal.title}</h3>
          <span>{signal.severity}</span>
        </div>
        <p>{signal.summary}</p>
        <code>{signal.evidencePaths.join(" · ")}</code>
      </div>
    </article>
  );
}

function ActivityItem({ event, index }: { event: ActivityEvent; index: number }) {
  return (
    <article className="activity-item">
      <div className="timeline-marker"><span>{String(index + 1).padStart(2, "0")}</span></div>
      <div className="activity-content">
        <div className="activity-title-line">
          <strong>{titleCase(event.type)}</strong>
          <span className={event.succeeded === false ? "tx-failed" : "tx-ok"}>
            {event.succeeded === null ? "status unknown" : event.succeeded ? "succeeded" : "failed"}
          </span>
        </div>
        <p>{event.evidence}</p>
        <div className="activity-facts">
          <code>slot {event.slot.toLocaleString("en")}</code>
          <span>{formatDate(event.blockTime)}</span>
          <a href={event.explorerUrl} target="_blank" rel="noreferrer">
            {shorten(event.signature)} <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </article>
  );
}

function Report({ report }: { report: InspectionReport }) {
  return (
    <div className="report-stack">
      <section className={`verdict verdict-${report.verdict.level}`}>
        <div className="verdict-code">
          <span>CONTROL PASSPORT</span>
          <strong>{report.verdict.level.toUpperCase()}</strong>
        </div>
        <div className="verdict-copy">
          <p className="eyebrow">Deterministic classifier / {report.reproducibility.classifierVersion}</p>
          <h1>{report.verdict.headline}</h1>
          <p>{report.verdict.summary}</p>
        </div>
        <a className="explorer-button" href={report.identity.explorerUrl} target="_blank" rel="noreferrer">
          Explorer <ArrowUpRight size={16} />
        </a>
      </section>

      <section className="metric-strip" aria-label="Inspection summary">
        <div><span>Execution</span><strong>{report.identity.executable ? "Executable" : "Not executable"}</strong></div>
        <div><span>Loader</span><strong>{titleCase(report.identity.loaderKind)}</strong></div>
        <div><span>Control</span><strong>{titleCase(report.control.state)}</strong></div>
        <div><span>Observed slot</span><strong>{report.observationSlot.toLocaleString("en")}</strong></div>
        <div><span>Evidence</span><strong>{report.status === "complete" ? "Complete" : "Partial"}</strong></div>
      </section>

      <div className="report-grid two-up">
        <section className="panel">
          <SectionHeader icon={<KeyRound size={17} />} index="01" title="Control plane" />
          <div className="address-plate">
            <span className="field-label">Program</span>
            <div className="value-line"><code>{report.identity.programAddress}</code><CopyButton value={report.identity.programAddress} /></div>
          </div>
          <EvidenceRow label="ProgramData" evidence={report.control.programDataAddress} />
          <EvidenceRow label="Upgrade authority" evidence={report.control.upgradeAuthority} />
          <EvidenceRow label="Deployment slot" evidence={report.control.deploymentSlot} />
        </section>

        <section className="panel fingerprint-panel">
          <SectionHeader icon={<Fingerprint size={17} />} index="02" title="Byte fingerprint" meta={report.fingerprint.algorithm} />
          <div className={`digest-block ${report.fingerprint.state === "unknown" ? "digest-unknown" : ""}`}>
            <span className="field-label">Digest</span>
            <code>{report.fingerprint.digest ?? "No supported code region"}</code>
            {report.fingerprint.digest && <CopyButton value={report.fingerprint.digest} label="Copy SHA-256 digest" />}
          </div>
          <dl className="fact-grid">
            <div><dt>Byte length</dt><dd>{report.fingerprint.byteLength?.toLocaleString("en") ?? "Unknown"}</dd></div>
            <div><dt>Observation slot</dt><dd>{report.fingerprint.observationSlot.toLocaleString("en")}</dd></div>
            <div><dt>Account bytes</dt><dd>{report.identity.accountDataBytes.toLocaleString("en")}</dd></div>
            <div><dt>Commitment</dt><dd>{report.request.commitment}</dd></div>
          </dl>
          <p className="source-note"><Database size={14} /> {report.fingerprint.source}</p>
        </section>
      </div>

      <div className="report-grid history-grid">
        <section className="panel activity-panel">
          <SectionHeader
            icon={<Activity size={17} />}
            index="03"
            title="Bounded activity"
            meta={`${report.activity.scannedTransactions}/${report.activity.transactionLimit} tx inspected`}
          />
          {report.activity.events.length > 0 ? (
            <div className="timeline">
              {report.activity.events.map((event, index) => <ActivityItem key={event.signature} event={event} index={index} />)}
            </div>
          ) : (
            <div className="quiet-state">
              <Clock3 size={24} />
              <div>
                <strong>No named loader event in the inspected window</strong>
                <p>This is limited to {report.activity.scannedTransactions} decoded transaction(s) from {report.activity.scannedSignatures} recent signature(s), not the program's full history.</p>
              </div>
            </div>
          )}
          <div className="bounded-note">
            <Gauge size={14} /> Window cap: {report.activity.signatureLimit} signatures / {report.activity.transactionLimit} transactions
          </div>
        </section>

        <section className="panel signal-panel">
          <SectionHeader icon={<ShieldCheck size={17} />} index="04" title="Risk signals" meta={`${report.signals.length} rules`} />
          <div className="signal-list">
            {report.signals.map((signal) => <Signal key={signal.id} signal={signal} />)}
          </div>
        </section>
      </div>

      {report.evidenceGaps.length > 0 && (
        <section className="gap-band">
          <div className="gap-title"><AlertTriangle size={18} /><strong>Evidence gaps</strong></div>
          <ul>{report.evidenceGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
        </section>
      )}

      <section className="reproduce-band">
        <div>
          <span className="eyebrow">Reproduce this observation</span>
          <code>{report.reproducibility.apiUrl}</code>
        </div>
        <CopyButton value={report.reproducibility.apiUrl} label="Copy API URL" />
        <a href="/api/openapi.json" target="_blank" rel="noreferrer">OpenAPI <ExternalLink size={13} /></a>
        <span>{report.meta.durationMs} ms · {formatDate(report.observedAt)}</span>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="loading-state" aria-live="polite">
      <div className="scan-rail"><span /></div>
      <LoaderCircle className="spin" size={26} />
      <div><strong>Resolving program evidence</strong><p>Account → loader state → code bytes → bounded activity</p></div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="empty-workspace">
      <div className="empty-diagram" aria-hidden="true">
        <span className="diagram-node active"><Code2 size={18} /></span>
        <i />
        <span className="diagram-node"><KeyRound size={18} /></span>
        <i />
        <span className="diagram-node"><Fingerprint size={18} /></span>
        <i />
        <span className="diagram-node"><ShieldCheck size={18} /></span>
      </div>
      <p className="eyebrow">Evidence engine ready</p>
      <h1>Inspect a program address</h1>
      <p>Results distinguish observed facts, deterministic signals, and unavailable evidence.</p>
    </section>
  );
}

export function App() {
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [program, setProgram] = useState(initial.get("program") ?? "");
  const [network, setNetwork] = useState<SolanaNetwork>(initial.get("network") === "devnet" ? "devnet" : "mainnet-beta");
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [error, setError] = useState<RequestError | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewMode>("report");

  async function runInspection(nextProgram = program, nextNetwork = network) {
    const normalized = nextProgram.trim();
    setProgram(normalized);
    setNetwork(nextNetwork);
    setLoading(true);
    setError(null);
    setReport(null);
    setView("report");
    const params = new URLSearchParams({ network: nextNetwork, program: normalized });
    window.history.replaceState(null, "", `?${params.toString()}`);
    try {
      const response = await fetch(`/api/inspect?${params.toString()}`, { headers: { accept: "application/json" } });
      const body: unknown = await response.json();
      if (!response.ok) {
        const candidate = body as { error?: RequestError };
        throw candidate.error ?? { code: `HTTP_${response.status}`, message: "Inspection failed" };
      }
      setReport(body as InspectionReport);
    } catch (cause) {
      const candidate = cause as Partial<RequestError>;
      setError({ code: candidate.code ?? "NETWORK_ERROR", message: candidate.message ?? "The inspection request could not be completed.", requestId: candidate.requestId });
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void runInspection();
  }

  useEffect(() => {
    const initialProgram = initial.get("program");
    if (initialProgram) void runInspection(initialProgram, initial.get("network") === "devnet" ? "devnet" : "mainnet-beta");
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Slotglass home">
          <span className="brand-mark"><span /></span>
          <strong>SLOTGLASS</strong>
          <small>CONTROL EVIDENCE</small>
        </a>
        <nav>
          <a href="/api/openapi.json" target="_blank" rel="noreferrer"><Braces size={15} /> API</a>
          <a href="https://github.com/nonggde/slotglass" target="_blank" rel="noreferrer"><Github size={15} /> Source</a>
          <span className="network-status"><i /> RPC public</span>
        </nav>
      </header>

      <main>
        <section className="search-workbench">
          <div className="workbench-title">
            <span className="eyebrow">Solana program risk passport</span>
            <p>Observed control state. Reproducible evidence. Explicit unknowns.</p>
          </div>
          <form onSubmit={submit}>
            <div className="network-segment" aria-label="Solana network">
              <button className={network === "mainnet-beta" ? "selected" : ""} type="button" onClick={() => setNetwork("mainnet-beta")}>Mainnet</button>
              <button className={network === "devnet" ? "selected" : ""} type="button" onClick={() => setNetwork("devnet")}>Devnet</button>
            </div>
            <label className="address-input">
              <Search size={19} />
              <input
                value={program}
                onChange={(event) => setProgram(event.target.value)}
                placeholder="Solana program address"
                spellCheck={false}
                autoComplete="off"
                aria-label="Solana program address"
              />
              {program && <button type="button" className="clear-button" onClick={() => setProgram("")} aria-label="Clear address" title="Clear address"><X size={15} /></button>}
            </label>
            <button className="inspect-button" type="submit" disabled={loading || !program.trim()}>
              {loading ? <LoaderCircle className="spin" size={17} /> : <Fingerprint size={17} />}
              Inspect program
              <ChevronRight size={16} />
            </button>
          </form>
          <div className="example-row">
            <span>Known programs</span>
            {EXAMPLES.map((example) => (
              <button key={example.address} type="button" onClick={() => void runInspection(example.address, example.network)}>
                {example.label} <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
        </section>

        <div className="workspace-toolbar">
          <div className="view-tabs" role="tablist" aria-label="Inspection view">
            <button type="button" role="tab" aria-selected={view === "report"} className={view === "report" ? "active" : ""} onClick={() => setView("report")}>
              <Clipboard size={14} /> Report
            </button>
            <button type="button" role="tab" aria-selected={view === "json"} className={view === "json" ? "active" : ""} onClick={() => setView("json")} disabled={!report}>
              <TerminalSquare size={14} /> JSON
            </button>
          </div>
          {report && <div className="workspace-id"><Network size={13} /> {report.identity.network} / {shorten(report.identity.programAddress)}</div>}
        </div>

        <div className="workspace">
          {loading && <LoadingState />}
          {!loading && error && (
            <section className="error-state">
              <AlertTriangle size={24} />
              <div><span>{error.code}</span><h1>{error.message}</h1>{error.requestId && <code>request {error.requestId}</code>}</div>
            </section>
          )}
          {!loading && !error && !report && <EmptyState />}
          {!loading && report && view === "report" && <Report report={report} />}
          {!loading && report && view === "json" && (
            <section className="json-view">
              <header><div><Braces size={16} /><strong>{report.schemaVersion}</strong></div><CopyButton value={JSON.stringify(report, null, 2)} label="Copy JSON report" /></header>
              <pre>{JSON.stringify(report, null, 2)}</pre>
            </section>
          )}
        </div>
      </main>

      <footer>
        <div><span className="brand-mark mini"><span /></span><strong>Slotglass</strong></div>
        <p>Evidence is observational and bounded. It is not an audit or security certification.</p>
        <span>schema v1 · classifier 2026-07-15.1</span>
      </footer>
    </div>
  );
}
