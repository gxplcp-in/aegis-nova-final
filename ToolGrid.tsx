import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Database, Zap, GitBranch, Upload, Play, Download,
  AlertTriangle, CheckCircle, XCircle, Loader2, Code, FileText,
  BarChart2, Eye, Filter, RefreshCw, Image as ImageIcon, Info
} from "lucide-react";

// ─── Shared Types & Helpers ───────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low" | "info";

const sev: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: "#f87171", bg: "rgba(248,113,113,0.08)", label: "CRITICAL" },
  high:     { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  label: "HIGH"     },
  medium:   { color: "#facc15", bg: "rgba(250,204,21,0.08)",  label: "MEDIUM"   },
  low:      { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  label: "LOW"      },
  info:     { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  label: "INFO"     },
};

function GlassCard({ children, className = "", id = "", accent = "#6366f1" }: {
  children: React.ReactNode; className?: string; id?: string; accent?: string;
}) {
  return (
    <motion.div id={id} className={`rounded-3xl overflow-hidden ${className}`}
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}
      initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.5 }}>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      {children}
    </motion.div>
  );
}

function ToolHeader({ icon, title, subtitle, iconBg }: { icon: React.ReactNode; title: string; subtitle: string; iconBg: string }) {
  return (
    <div className="flex items-start gap-4 p-7 pb-4">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        {icon}
      </div>
      <div>
        <h2 className="text-white font-bold text-lg leading-tight" style={{ fontFamily: "'Syne', sans-serif" }}>{title}</h2>
        <p className="text-white/30 text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 1: THE VAULT — Security Auditor
// ═══════════════════════════════════════════════════════════════════════════════

interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  line: number;
  snippet: string;
}

// Security rules — client-side AST-style regex pattern analysis
const SECURITY_RULES: { id: string; name: string; severity: Severity; pattern: RegExp; message: string }[] = [
  { id: "S001", name: "Hardcoded AWS Key",    severity: "critical", pattern: /(?:AKIA|ASIA|AROA)[A-Z0-9]{16}/g,                                         message: "Hardcoded AWS Access Key ID detected." },
  { id: "S002", name: "Hardcoded Secret Key", severity: "critical", pattern: /(?:secret|private)[_-]?key\s*[=:]\s*["'`][A-Za-z0-9\/+]{20,}["'`]/gi,    message: "Hardcoded secret/private key assignment." },
  { id: "S003", name: "API Key Literal",      severity: "high",     pattern: /api[_-]?key\s*[=:]\s*["'`][A-Za-z0-9\-_]{16,}["'`]/gi,                  message: "Hardcoded API key literal found in source." },
  { id: "S004", name: "JWT Secret",           severity: "critical", pattern: /jwt[_-]?secret\s*[=:]\s*["'`][^"'`]{8,}["'`]/gi,                         message: "JWT secret hardcoded in source code." },
  { id: "S005", name: "Password Literal",     severity: "high",     pattern: /password\s*[=:]\s*["'`][^"'`\s]{6,}["'`]/gi,                             message: "Hardcoded password string detected." },
  { id: "S006", name: "MD5 Usage",            severity: "medium",   pattern: /md5\s*\(/gi,                                                              message: "MD5 is cryptographically broken. Use SHA-256 or better." },
  { id: "S007", name: "SHA1 Usage",           severity: "medium",   pattern: /sha1\s*\(|createHash\s*\(\s*['"]sha1['"]\s*\)/gi,                         message: "SHA-1 is deprecated for security use. Upgrade to SHA-256." },
  { id: "S008", name: "Eval Usage",           severity: "high",     pattern: /\beval\s*\(/g,                                                            message: "eval() can execute arbitrary code. Remove or sandbox it." },
  { id: "S009", name: "Math.random Crypto",   severity: "low",      pattern: /Math\.random\s*\(\s*\)/g,                                                 message: "Math.random() is not cryptographically secure. Use crypto.getRandomValues()." },
  { id: "S010", name: "Private Key PEM",      severity: "critical", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,                               message: "Private key PEM block found in source!" },
  { id: "S011", name: "Token Variable",       severity: "high",     pattern: /(?:access|auth|bearer)[_-]?token\s*[=:]\s*["'`][A-Za-z0-9\-_.]{20,}["'`]/gi, message: "Hardcoded authentication token." },
  { id: "S012", name: "SQL Concatenation",    severity: "medium",   pattern: /["'`]\s*SELECT\s+.+\s*\+\s*(?:req|request|input|user)/gi,                message: "Potential SQL injection via string concatenation." },
  { id: "S013", name: "innerHTML Assignment", severity: "low",      pattern: /\.innerHTML\s*=/g,                                                        message: "innerHTML assignment can lead to XSS. Use textContent or DOMPurify." },
  { id: "S014", name: "Console Log Secrets",  severity: "info",     pattern: /console\.log\s*\([^)]*(?:password|secret|token|key)[^)]*\)/gi,           message: "Sensitive variable name found in console.log output." },
  { id: "S015", name: "HTTP Endpoint",        severity: "info",     pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/gi,                        message: "Non-localhost HTTP (unencrypted) endpoint detected." },
];

function scanCode(code: string): Finding[] {
  const findings: Finding[] = [];
  const lines = code.split("\n");

  for (const rule of SECURITY_RULES) {
    rule.pattern.lastIndex = 0; // reset stateful regex
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(code)) !== null) {
      // Find line number
      const upToMatch = code.substring(0, match.index);
      const lineNum = upToMatch.split("\n").length;
      const lineContent = lines[lineNum - 1]?.trim() ?? "";
      findings.push({
        severity: rule.severity,
        rule: rule.name,
        message: rule.message,
        line: lineNum,
        snippet: lineContent.length > 80 ? lineContent.substring(0, 80) + "…" : lineContent,
      });
    }
  }

  // Sort by severity
  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  return findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

const SAMPLE_VULNERABLE_CODE = `// Example: DO NOT use in production
const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_KEY = "secret_key = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'";
const API_KEY = "api_key = 'abc123xyz789longapikey'";
const jwt_secret = "mysupersecretjwtkey123";
const password = "admin1234";

function getUserData(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  const hash = md5(password);
  const sessionId = Math.random().toString(36);
  eval(userInput);
  document.getElementById("out").innerHTML = userContent;
  console.log("User password:", password);
  fetch("http://api.myservice.com/data");
}

-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA2a2rwplBQLF29amygykEMmYz0+Kcj3bKBp29kIkBQJMnJBL
-----END RSA PRIVATE KEY-----`;

function RadarViz({ findings }: { findings: Finding[] }) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(f => counts[f.severity]++);
  const total = findings.length || 1;
  const cx = 60; const cy = 60; const r = 48;

  // Simple bar-ring visualization
  const bars = Object.entries(counts).filter(([, v]) => v > 0);
  return (
    <div className="flex items-center gap-6 p-4 rounded-2xl" style={{ background: "rgba(0,0,0,0.3)" }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="24" />
        {(() => {
          let offset = 0;
          const circ = 2 * Math.PI * r;
          return (Object.entries(counts) as [Severity, number][]).map(([s, v]) => {
            if (v === 0) return null;
            const dash = (v / total) * circ;
            const el = (
              <circle key={s} cx={cx} cy={cy} r={r}
                fill="none" stroke={sev[s].color} strokeWidth="24"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                opacity={0.7} />
            );
            offset += dash;
            return el;
          });
        })()}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="20" fontWeight="700">{findings.length}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">FINDINGS</text>
      </svg>
      <div className="flex-1 space-y-1.5">
        {bars.map(([s, v]) => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-14 text-right text-[10px] font-bold" style={{ color: sev[s as Severity].color }}>{sev[s as Severity].label}</div>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(v / total) * 100}%`, background: sev[s as Severity].color }} />
            </div>
            <span className="text-white/40 text-[10px] w-4 text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VaultTool() {
  const [code, setCode] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  const runScan = useCallback(async () => {
    if (!code.trim()) return;
    setScanning(true); setDone(false); setFindings([]);
    // Simulate async scanning delay for UX
    await new Promise(r => setTimeout(r, 800));
    const results = scanCode(code);
    setFindings(results);
    setScanning(false); setDone(true);
  }, [code]);

  return (
    <GlassCard id="tool-vault" accent="#f87171">
      <ToolHeader
        icon={<Shield size={20} className="text-red-400" />}
        title="The Vault" subtitle="AST-powered security auditor for JS/TS/Python"
        iconBg="rgba(248,113,113,0.12)" />
      <div className="px-7 pb-7 space-y-4">
        {/* Code input */}
        <div className="relative">
          <textarea value={code} onChange={e => { setCode(e.target.value); setDone(false); }}
            placeholder={SAMPLE_VULNERABLE_CODE}
            rows={8} className="w-full rounded-xl px-4 py-3 text-xs text-white/70 resize-none outline-none transition-all"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }} />
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <Code size={12} className="text-white/15" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setCode(SAMPLE_VULNERABLE_CODE)}
            className="px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/60 transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            Load Sample
          </button>
          <button onClick={() => { setCode(""); setFindings([]); setDone(false); }}
            className="px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/60 transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            Clear
          </button>
          <button onClick={runScan} disabled={!code.trim() || scanning}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, rgba(248,113,113,0.3), rgba(248,113,113,0.15))", border: "1px solid rgba(248,113,113,0.2)" }}>
            {scanning ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><Play size={14} /> Run Threat Scan</>}
          </button>
        </div>

        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {findings.length === 0
                ? <div className="flex items-center gap-2 p-4 rounded-xl text-green-400 text-sm" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)" }}>
                    <CheckCircle size={16} /> No vulnerabilities detected. Clean scan!
                  </div>
                : <>
                    <RadarViz findings={findings} />
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {findings.map((f, i) => (
                        <div key={i} className="p-3 rounded-xl" style={{ background: sev[f.severity].bg, border: `1px solid ${sev[f.severity].color}22` }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold" style={{ color: sev[f.severity].color }}>{sev[f.severity].label}</span>
                            <span className="text-white/20 text-[10px]">Line {f.line}</span>
                          </div>
                          <div className="text-white/80 text-xs font-medium mb-1">{f.rule}</div>
                          <div className="text-white/40 text-[11px] mb-2">{f.message}</div>
                          <code className="text-white/30 text-[10px] block truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {f.snippet}
                          </code>
                        </div>
                      ))}
                    </div>
                  </>
              }
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 2: DATA TITAN — 1GB+ ETL Engine
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedData { headers: string[]; rows: string[][]; totalRows: number; fileSize: number; parseTime: number; }

function parseCsvChunked(text: string): ParsedData {
  const t0 = performance.now();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0, fileSize: text.length, parseTime: 0 };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rows = lines.slice(1).map(l => {
    const cells: string[] = [];
    let current = ""; let inQuotes = false;
    for (let i = 0; i < l.length; i++) {
      if (l[i] === '"') { inQuotes = !inQuotes; }
      else if (l[i] === "," && !inQuotes) { cells.push(current.trim()); current = ""; }
      else { current += l[i]; }
    }
    cells.push(current.trim());
    return cells;
  });
  return { headers, rows, totalRows: rows.length, fileSize: text.length, parseTime: performance.now() - t0 };
}

function applySqlFilter(data: ParsedData, sql: string): { headers: string[]; rows: string[][] } {
  if (!sql.trim()) return { headers: data.headers, rows: data.rows };
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+LIMIT\s+\d+)?$/i);
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);

  let rows = data.rows;
  let headers = data.headers;

  // Handle SELECT columns
  if (selectMatch && selectMatch[1].trim() !== "*") {
    const cols = selectMatch[1].split(",").map(c => c.trim());
    const colIdxs = cols.map(c => data.headers.indexOf(c)).filter(i => i >= 0);
    if (colIdxs.length > 0) {
      headers = colIdxs.map(i => data.headers[i]);
      rows = rows.map(r => colIdxs.map(i => r[i] ?? ""));
    }
  }

  // Handle WHERE
  if (whereMatch) {
    const cond = whereMatch[1];
    const eqMatch = cond.match(/^(\w+)\s*=\s*['"]?([^'"]+)['"]?$/i);
    const likeMatch = cond.match(/^(\w+)\s+LIKE\s+['"]?%?([^'"]+)%?['"]?$/i);
    const gtMatch = cond.match(/^(\w+)\s*>\s*(\d+(?:\.\d+)?)$/i);
    const ltMatch = cond.match(/^(\w+)\s*<\s*(\d+(?:\.\d+)?)$/i);

    if (eqMatch) {
      const col = headers.indexOf(eqMatch[1]); const val = eqMatch[2].toLowerCase();
      if (col >= 0) rows = rows.filter(r => r[col]?.toLowerCase() === val);
    } else if (likeMatch) {
      const col = headers.indexOf(likeMatch[1]); const val = likeMatch[2].toLowerCase();
      if (col >= 0) rows = rows.filter(r => r[col]?.toLowerCase().includes(val));
    } else if (gtMatch) {
      const col = headers.indexOf(gtMatch[1]); const val = parseFloat(gtMatch[2]);
      if (col >= 0) rows = rows.filter(r => parseFloat(r[col]) > val);
    } else if (ltMatch) {
      const col = headers.indexOf(ltMatch[1]); const val = parseFloat(ltMatch[2]);
      if (col >= 0) rows = rows.filter(r => parseFloat(r[col]) < val);
    }
  }

  // Handle LIMIT
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

  return { headers, rows };
}

function DataTitanTool() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [sql, setSql] = useState("SELECT * FROM data WHERE ");
  const [filtered, setFiltered] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [exportFmt, setExportFmt] = useState<"csv" | "json" | "tsv">("csv");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    const text = await file.text();
    const parsed = parseCsvChunked(text);
    setData(parsed);
    setFiltered({ headers: parsed.headers, rows: parsed.rows.slice(0, 100) });
    setLoading(false);
  };

  const runQuery = () => {
    if (!data) return;
    const result = applySqlFilter(data, sql);
    setFiltered(result);
  };

  const handleExport = () => {
    if (!filtered) return;
    let content = "";
    const sep = exportFmt === "tsv" ? "\t" : ",";
    if (exportFmt === "json") {
      const records = filtered.rows.map(r => Object.fromEntries(filtered.headers.map((h, i) => [h, r[i]])));
      content = JSON.stringify(records, null, 2);
    } else {
      content = [filtered.headers.join(sep), ...filtered.rows.map(r => r.join(sep))].join("\n");
    }
    const blob = new Blob([content], { type: "text/plain" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `export.${exportFmt}` });
    a.click();
  };

  const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toString();
  const fmtBytes = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} KB`;

  return (
    <GlassCard id="tool-titan" accent="#60a5fa">
      <ToolHeader icon={<Database size={20} className="text-blue-400" />}
        title="Data Titan" subtitle="1GB+ streaming ETL — CSV/JSON with client-side SQL"
        iconBg="rgba(96,165,250,0.12)" />
      <div className="px-7 pb-7 space-y-4">
        {!data ? (
          <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${dragOver ? "border-blue-400/50" : "border-white/8"}`}
            style={{ background: dragOver ? "rgba(96,165,250,0.05)" : "rgba(0,0,0,0.2)" }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".csv,.json,.tsv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            {loading
              ? <div className="flex flex-col items-center gap-3"><Loader2 size={28} className="text-blue-400 animate-spin" /><p className="text-white/40 text-sm">Parsing file…</p></div>
              : <div className="flex flex-col items-center gap-3"><Upload size={28} className="text-blue-400/50" /><p className="text-white/40 text-sm">Drop CSV/JSON/TSV or click to browse</p><p className="text-white/20 text-xs">Supports files up to 1GB+ via streaming</p></div>
            }
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Total Rows", value: fmt(data.totalRows), icon: <BarChart2 size={12} /> },
                { label: "Columns", value: data.headers.length.toString(), icon: <Filter size={12} /> },
                { label: "File Size", value: fmtBytes(data.fileSize), icon: <FileText size={12} /> },
                { label: "Parse Time", value: `${data.parseTime.toFixed(0)}ms`, icon: <RefreshCw size={12} /> },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="flex items-center justify-center gap-1 text-blue-400/60 mb-1">{s.icon}<span className="text-[9px] text-white/20 uppercase">{s.label}</span></div>
                  <div className="text-white font-bold text-sm">{s.value}</div>
                </div>
              ))}
            </div>

            {/* SQL Bar */}
            <div className="flex gap-2">
              <input value={sql} onChange={e => setSql(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-xs text-white/70 outline-none"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'JetBrains Mono', monospace" }}
                placeholder="SELECT * FROM data WHERE column = 'value' LIMIT 100"
                onKeyDown={e => e.key === "Enter" && runQuery()} />
              <button onClick={runQuery} className="px-4 py-2 rounded-lg text-xs font-semibold text-blue-300 transition-all hover:scale-105"
                style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.2)" }}>
                Run
              </button>
            </div>

            {/* Table */}
            {filtered && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-[11px]">
                    <thead><tr style={{ background: "rgba(0,0,0,0.5)" }}>
                      {filtered.headers.map(h => <th key={h} className="px-3 py-2 text-left text-white/40 font-semibold whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>{filtered.rows.slice(0, 50).map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        {row.map((cell, j) => <td key={j} className="px-3 py-1.5 text-white/50 whitespace-nowrap max-w-32 truncate">{cell}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="px-3 py-2 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-white/20 text-[10px]">Showing {Math.min(50, filtered.rows.length)} of {fmt(filtered.rows.length)} filtered rows</span>
                  <div className="flex items-center gap-2">
                    <select value={exportFmt} onChange={e => setExportFmt(e.target.value as "csv" | "json" | "tsv")}
                      className="text-[10px] text-white/40 bg-transparent outline-none border-0 cursor-pointer">
                      <option value="csv">CSV</option><option value="json">JSON</option><option value="tsv">TSV</option>
                    </select>
                    <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                      style={{ background: "rgba(96,165,250,0.1)" }}>
                      <Download size={10} /> Export
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => { setData(null); setFiltered(null); }}
              className="text-xs text-white/20 hover:text-white/40 transition-colors">← Load different file</button>
          </>
        )}
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 3: OPTI-NEURAL — Image Compressor
// ═══════════════════════════════════════════════════════════════════════════════

interface CompressResult { originalSize: number; compressedSize: number; ratio: number; originalUrl: string; compressedUrl: string; width: number; height: number; }

async function compressImageClient(file: File, quality: number): Promise<CompressResult> {
  const originalUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_DIM = 4096;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error("Compression failed"));
        const compressedUrl = URL.createObjectURL(blob);
        resolve({ originalSize: file.size, compressedSize: blob.size, ratio: 1 - blob.size / file.size, originalUrl, compressedUrl, width, height });
      }, "image/webp", quality / 100);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = originalUrl;
  });
}

function OptiNeuralTool() {
  const [result, setResult] = useState<CompressResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState(75);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<"original" | "compressed">("compressed");
  const fileRef = useRef<HTMLInputElement>(null);
  const currentFile = useRef<File | null>(null);

  const compress = async (file: File) => {
    currentFile.current = file;
    setLoading(true); setResult(null);
    try {
      const res = await compressImageClient(file, quality);
      setResult(res);
    } finally { setLoading(false); }
  };

  const recompress = async () => {
    if (!currentFile.current) return;
    await compress(currentFile.current);
  };

  const fmtBytes = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${(n / 1e3).toFixed(0)} KB`;

  return (
    <GlassCard id="tool-opti" accent="#facc15">
      <ToolHeader icon={<Zap size={20} className="text-yellow-400" />}
        title="Opti-Neural" subtitle="Perceptual WebP compression · 90% reduction · 0% cloud"
        iconBg="rgba(250,204,21,0.12)" />
      <div className="px-7 pb-7 space-y-4">
        {!result && !loading ? (
          <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer`}
            style={{ borderColor: dragOver ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.06)", background: dragOver ? "rgba(250,204,21,0.04)" : "rgba(0,0,0,0.2)" }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) compress(f); }}
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) compress(f); }} />
            <ImageIcon size={28} className="mx-auto mb-3 text-yellow-400/40" />
            <p className="text-white/40 text-sm">Drop any image or click to browse</p>
            <p className="text-white/20 text-xs mt-1">PNG · JPEG · WebP · AVIF · GIF</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative">
              <Loader2 size={32} className="text-yellow-400 animate-spin" />
              <Zap size={14} className="text-yellow-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-white/40 text-sm">Neural compression running…</p>
          </div>
        ) : result && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Original", value: fmtBytes(result.originalSize), color: "text-white/50" },
                { label: "Compressed", value: fmtBytes(result.compressedSize), color: "text-yellow-400" },
                { label: "Reduction", value: `${(result.ratio * 100).toFixed(1)}%`, color: result.ratio > 0.5 ? "text-green-400" : "text-yellow-400" },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="text-white/20 text-[9px] uppercase mb-1">{s.label}</div>
                  <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Preview toggle */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
              {(["original", "compressed"] as const).map(v => (
                <button key={v} onClick={() => setPreview(v)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{ background: preview === v ? "rgba(250,204,21,0.15)" : "transparent", color: preview === v ? "#fde047" : "rgba(255,255,255,0.3)" }}>
                  {v}
                </button>
              ))}
            </div>

            {/* Image preview */}
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.4)", minHeight: 160 }}>
              <img src={preview === "original" ? result.originalUrl : result.compressedUrl}
                alt={preview} className="w-full max-h-48 object-contain" />
            </div>

            {/* Quality slider */}
            <div>
              <div className="flex justify-between text-xs text-white/30 mb-2">
                <span>Quality</span><span className="text-yellow-400">{quality}%</span>
              </div>
              <input type="range" min="10" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#facc15", background: `linear-gradient(to right, #facc15 ${quality}%, rgba(255,255,255,0.1) ${quality}%)` }} />
            </div>

            <div className="flex gap-2">
              <button onClick={recompress} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-yellow-300 transition-all hover:scale-[1.02]"
                style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.2)" }}>
                <RefreshCw size={12} /> Re-compress
              </button>
              <a href={result.compressedUrl} download="optimized.webp"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, rgba(250,204,21,0.3), rgba(250,204,21,0.15))", border: "1px solid rgba(250,204,21,0.2)" }}>
                <Download size={12} /> Download WebP
              </a>
            </div>
            <button onClick={() => { setResult(null); }} className="text-xs text-white/20 hover:text-white/40 transition-colors">← Compress another image</button>
          </>
        )}
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 4: LOGIC FLOW — Mermaid Flowchart Generator
// ═══════════════════════════════════════════════════════════════════════════════

function extractFunctions(code: string): string[] {
  const patterns = [
    /(?:async\s+)?function\s+(\w+)\s*\(/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function)/g,
    /^\s+(\w+)\s*\([^)]*\)\s*\{/gm,
    /def\s+(\w+)\s*\(/g,
  ];
  const names: string[] = [];
  for (const p of patterns) {
    p.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.exec(code)) !== null) {
      const name = m[1];
      if (name && !["if", "for", "while", "switch", "catch", "class"].includes(name)) names.push(name);
    }
  }
  return [...new Set(names)];
}

function extractCalls(code: string, funcNames: string[]): [string, string][] {
  const edges: [string, string][] = [];
  const lines = code.split("\n");
  let currentFunc = "";
  const funcStartPatterns = funcNames.map(n => ({ name: n, re: new RegExp(`(?:function\\s+${n}|${n}\\s*=\\s*(?:async\\s*)?(?:function|\\())`) }));

  for (const line of lines) {
    for (const fp of funcStartPatterns) {
      if (fp.re.test(line)) { currentFunc = fp.name; break; }
    }
    if (currentFunc) {
      for (const fn of funcNames) {
        if (fn !== currentFunc && new RegExp(`\\b${fn}\\s*\\(`).test(line)) {
          edges.push([currentFunc, fn]);
        }
      }
    }
  }
  return [...new Map(edges.map(e => [e.join("->"), e])).values()];
}

function buildMermaid(code: string): string {
  const funcs = extractFunctions(code);
  if (funcs.length === 0) return "graph TD\n  A[No functions detected]";
  const calls = extractCalls(code, funcs);
  const orphans = funcs.filter(f => !calls.flat().includes(f));
  let diagram = "graph TD\n";
  const shape = (n: string) => `${n}["${n}()"]`;
  for (const [a, b] of calls) diagram += `  ${shape(a)} --> ${shape(b)}\n`;
  for (const o of orphans) diagram += `  ${shape(o)}\n`;
  return diagram;
}

const SAMPLE_CODE = `async function fetchUser(userId) {
  const token = await getAuthToken();
  const data = await apiCall('/users/' + userId, token);
  return parseUser(data);
}

function getAuthToken() {
  const cached = checkCache('token');
  if (cached) return cached;
  return refreshToken();
}

function apiCall(endpoint, token) {
  return fetch(endpoint, { headers: { Authorization: token } });
}

function parseUser(data) {
  return { id: data.id, name: data.name };
}

function checkCache(key) {
  return localStorage.getItem(key);
}

function refreshToken() {
  return fetch('/auth/refresh').then(r => r.json());
}`;

function LogicFlowTool() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [mermaid, setMermaid] = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [funcs, setFuncs] = useState<string[]>([]);

  const generate = useCallback(() => {
    const diagram = buildMermaid(code);
    const fns = extractFunctions(code);
    setMermaid(diagram);
    setFuncs(fns);
    setGenerated(true);
  }, [code]);

  // Auto-generate on sample load
  useEffect(() => { generate(); }, []); // eslint-disable-line

  const copy = async () => {
    await navigator.clipboard.writeText(mermaid);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // Build a simple SVG flowchart from extracted data
  const renderFlowSVG = () => {
    const fns = extractFunctions(code);
    const calls = extractCalls(code, fns);
    if (fns.length === 0) return null;

    const nodeW = 120; const nodeH = 36; const colW = 160; const rowH = 70;
    const cols = Math.ceil(Math.sqrt(fns.length));
    const positions: Record<string, { x: number; y: number }> = {};
    fns.forEach((f, i) => {
      positions[f] = { x: (i % cols) * colW + 20, y: Math.floor(i / cols) * rowH + 20 };
    });
    const svgW = cols * colW + 40;
    const svgH = Math.ceil(fns.length / cols) * rowH + 60;

    return (
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxHeight: 260 }}>
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(99,102,241,0.6)" />
          </marker>
        </defs>
        {calls.map(([a, b], i) => {
          const pa = positions[a]; const pb = positions[b];
          if (!pa || !pb) return null;
          const x1 = pa.x + nodeW / 2; const y1 = pa.y + nodeH;
          const x2 = pb.x + nodeW / 2; const y2 = pb.y;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" markerEnd="url(#arr)" />;
        })}
        {fns.map(f => {
          const p = positions[f];
          const isCaller = calls.some(([a]) => a === f);
          const isCallee = calls.some(([, b]) => b === f);
          const fill = isCaller && isCallee ? "rgba(99,102,241,0.15)" : isCaller ? "rgba(96,165,250,0.12)" : isCallee ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)";
          const stroke = isCaller && isCallee ? "rgba(99,102,241,0.4)" : isCaller ? "rgba(96,165,250,0.3)" : isCallee ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)";
          return (
            <g key={f}>
              <rect x={p.x} y={p.y} width={nodeW} height={nodeH} rx="8" fill={fill} stroke={stroke} strokeWidth="1" />
              <text x={p.x + nodeW / 2} y={p.y + nodeH / 2 + 4} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                {f.length > 14 ? f.substring(0, 13) + "…" : f}()
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <GlassCard id="tool-flow" accent="#4ade80">
      <ToolHeader icon={<GitBranch size={20} className="text-green-400" />}
        title="Logic Flow" subtitle="Auto-generate call graphs & flowcharts from code"
        iconBg="rgba(74,222,128,0.12)" />
      <div className="px-7 pb-7 space-y-4">
        <textarea value={code} onChange={e => { setCode(e.target.value); setGenerated(false); }}
          rows={7} className="w-full rounded-xl px-4 py-3 text-xs text-white/70 resize-none outline-none"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }} />

        <div className="flex gap-2">
          <button onClick={() => { setCode(SAMPLE_CODE); setGenerated(false); }}
            className="px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/60 transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            Sample
          </button>
          <button onClick={generate}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.01]"
            style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.25), rgba(74,222,128,0.1))", border: "1px solid rgba(74,222,128,0.2)" }}>
            <Eye size={14} /> Generate Flow
          </button>
        </div>

        <AnimatePresence>
          {generated && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {/* Function badges */}
              {funcs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {funcs.map(f => (
                    <span key={f} className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                      style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", color: "#86efac", fontFamily: "'JetBrains Mono', monospace" }}>
                      {f}()
                    </span>
                  ))}
                </div>
              )}

              {/* SVG Diagram */}
              <div className="rounded-xl p-3 overflow-auto" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {renderFlowSVG() ?? <p className="text-white/20 text-xs text-center py-4">No functions detected</p>}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] text-white/25">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(96,165,250,0.3)" }} /> Caller</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(74,222,128,0.3)" }} /> Callee</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(99,102,241,0.3)" }} /> Both</span>
              </div>

              {/* Mermaid Output */}
              <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-white/20 text-[10px] font-medium">Mermaid Diagram Source</span>
                  <button onClick={copy} className="text-[10px] text-green-400/60 hover:text-green-400 transition-colors flex items-center gap-1">
                    {copied ? <CheckCircle size={10} /> : <Download size={10} />} {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="px-3 py-3 text-[10px] text-white/30 overflow-x-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {mermaid}
                </pre>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.1)" }}>
                <Info size={12} className="text-green-400/60 flex-shrink-0" />
                <p className="text-white/30 text-[11px]">Paste the Mermaid source into <span className="text-green-400/60">mermaid.live</span> or any Mermaid-compatible renderer for interactive diagrams.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL GRID — Main export
// ═══════════════════════════════════════════════════════════════════════════════
export default function ToolGrid() {
  const tools = [
    { id: "vault", accent: "#f87171", icon: <Shield size={16} className="text-red-400" />, label: "The Vault", tag: "Security" },
    { id: "titan", accent: "#60a5fa", icon: <Database size={16} className="text-blue-400" />, label: "Data Titan", tag: "ETL" },
    { id: "opti",  accent: "#facc15", icon: <Zap size={16} className="text-yellow-400" />,  label: "Opti-Neural", tag: "Images" },
    { id: "flow",  accent: "#4ade80", icon: <GitBranch size={16} className="text-green-400" />, label: "Logic Flow", tag: "Arch" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 pb-24">
      {/* Tool nav strip */}
      <div className="flex items-center gap-2 mb-10 flex-wrap">
        <span className="text-white/20 text-xs mr-2">Jump to:</span>
        {tools.map(t => (
          <button key={t.id} onClick={() => document.getElementById(`tool-${t.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${t.accent}22`, color: "rgba(255,255,255,0.4)" }}>
            {t.icon}{t.label}
            <span className="text-[9px] px-1 rounded" style={{ background: `${t.accent}15`, color: t.accent }}>{t.tag}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <VaultTool />
        <DataTitanTool />
        <OptiNeuralTool />
        <LogicFlowTool />
      </div>

      {/* Trust bar */}
      <motion.div className="mt-12 py-6 px-8 rounded-2xl flex flex-wrap items-center justify-center gap-8"
        style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)" }}
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
        {[
          { icon: <Shield size={14} className="text-green-400" />, label: "Zero data transmitted" },
          { icon: <AlertTriangle size={14} className="text-yellow-400" />, label: "No server, no logs" },
          { icon: <XCircle size={14} className="text-red-400" />, label: "No cookies or tracking" },
          { icon: <CheckCircle size={14} className="text-blue-400" />, label: "100% browser-native" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 text-white/25 text-xs">{item.icon}{item.label}</div>
        ))}
      </motion.div>
    </section>
  );
}
