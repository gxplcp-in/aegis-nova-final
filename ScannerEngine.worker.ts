/**
 * ScannerEngine.worker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Aegis Nova — Background Web Worker
 * Handles CPU-intensive processing off the main thread:
 *   1. Security scanning (The Vault)
 *   2. Large file CSV/JSON parsing (Data Titan)
 *   3. Statistical analysis & aggregation
 *
 * Usage (from main thread):
 *   const worker = new Worker(new URL('./ScannerEngine.worker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage({ type: 'SCAN_CODE', payload: { code: '...' } });
 *   worker.onmessage = (e) => console.log(e.data);
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Message Types ─────────────────────────────────────────────────────────────
export type WorkerInMessage =
  | { type: "SCAN_CODE";      payload: ScanCodePayload      }
  | { type: "PARSE_CSV";      payload: ParseCsvPayload      }
  | { type: "PARSE_JSON";     payload: ParseJsonPayload     }
  | { type: "AGGREGATE";      payload: AggregatePayload     }
  | { type: "FILTER_SQL";     payload: FilterSqlPayload     }
  | { type: "CONVERT_FORMAT"; payload: ConvertFormatPayload }
  | { type: "PING" };

export type WorkerOutMessage =
  | { type: "SCAN_RESULT";   payload: ScanResult       }
  | { type: "PARSE_RESULT";  payload: ParseResult      }
  | { type: "AGGREGATE_RESULT"; payload: AggregateResult }
  | { type: "FILTER_RESULT"; payload: FilterResult     }
  | { type: "CONVERT_RESULT"; payload: ConvertResult   }
  | { type: "PROGRESS";      payload: ProgressPayload  }
  | { type: "ERROR";         payload: { message: string; code: string } }
  | { type: "PONG" };

// ─── Payload Interfaces ────────────────────────────────────────────────────────
interface ScanCodePayload  { code: string; language?: "js" | "ts" | "py" | "auto"; }
interface ParseCsvPayload  { text: string; delimiter?: string; hasHeader?: boolean; maxRows?: number; }
interface ParseJsonPayload { text: string; }
interface AggregatePayload { headers: string[]; rows: string[][]; column: string; }
interface FilterSqlPayload { headers: string[]; rows: string[][]; sql: string; }
interface ConvertFormatPayload { headers: string[]; rows: string[][]; format: "csv" | "tsv" | "json" | "ndjson"; }
interface ProgressPayload  { stage: string; percent: number; rowsProcessed?: number; }

// ─── Result Interfaces ─────────────────────────────────────────────────────────
export interface SecurityFinding {
  severity:  "critical" | "high" | "medium" | "low" | "info";
  ruleId:    string;
  ruleName:  string;
  message:   string;
  line:      number;
  col:       number;
  snippet:   string;
  remediation: string;
}

export interface ScanResult {
  findings:      SecurityFinding[];
  scannedLines:  number;
  scannedChars:  number;
  scanDurationMs: number;
  severityCounts: Record<string, number>;
  riskScore:     number; // 0–100
}

export interface ParseResult {
  headers:    string[];
  rows:       string[][];
  totalRows:  number;
  totalCols:  number;
  fileSizeChars: number;
  parseDurationMs: number;
  nullCounts: Record<string, number>;
  sample:     string[][]; // first 5 rows
}

export interface AggregateResult {
  column:  string;
  count:   number;
  sum:     number;
  mean:    number;
  median:  number;
  min:     number;
  max:     number;
  stdDev:  number;
  nulls:   number;
  topValues: { value: string; count: number }[];
}

export interface FilterResult {
  headers:     string[];
  rows:        string[][];
  matchedRows: number;
  totalRows:   number;
  durationMs:  number;
}

export interface ConvertResult {
  content:    string;
  format:     string;
  rowCount:   number;
  sizeChars:  number;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY SCANNER ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

interface SecurityRule {
  id:           string;
  name:         string;
  severity:     "critical" | "high" | "medium" | "low" | "info";
  pattern:      RegExp;
  message:      string;
  remediation:  string;
  languages:    string[];
}

const SECURITY_RULES: SecurityRule[] = [
  {
    id: "SEC-001", name: "AWS Access Key ID", severity: "critical",
    pattern: /(?:AKIA|ASIA|AROA|AGPA|AIDA|AIPA|ANPA|ANVA|AKIA)[A-Z0-9]{16}/g,
    message: "Hardcoded AWS Access Key ID found in source code.",
    remediation: "Move to environment variables or AWS Secrets Manager. Rotate the exposed key immediately.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-002", name: "AWS Secret Access Key", severity: "critical",
    pattern: /(?:aws[_\-\s]?secret[_\-\s]?(?:access[_\-\s]?)?key|AWS_SECRET)['":\s]*[=:]['":\s]*([A-Za-z0-9/+]{40})/gi,
    message: "Hardcoded AWS Secret Access Key detected.",
    remediation: "Use IAM roles or store in AWS Secrets Manager. Rotate immediately.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-003", name: "Generic API Key", severity: "high",
    pattern: /api[_-]?key\s*[=:]\s*["'`]([A-Za-z0-9\-_]{16,64})["'`]/gi,
    message: "Hardcoded API key literal found.",
    remediation: "Store in environment variables. Never commit secrets to version control.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-004", name: "JWT Secret", severity: "critical",
    pattern: /jwt[_-]?secret\s*[=:]\s*["'`]([^"'`\s]{8,})["'`]/gi,
    message: "JWT signing secret hardcoded in source.",
    remediation: "Use a randomly generated 256-bit key from a secrets vault.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-005", name: "Password Literal", severity: "high",
    pattern: /(?:^|[^a-z])password\s*[=:]\s*["'`]([^"'`\s]{4,})["'`]/gim,
    message: "Hardcoded password string detected.",
    remediation: "Hash passwords with bcrypt/argon2. Never store plaintext passwords.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-006", name: "Private Key PEM Block", severity: "critical",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    message: "Private key PEM block embedded in source code!",
    remediation: "Remove immediately. Use a key management service (AWS KMS, HashiCorp Vault).",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-007", name: "MD5 Hash Usage", severity: "medium",
    pattern: /\bmd5\s*\(|createHash\s*\(\s*["']md5["']\s*\)/gi,
    message: "MD5 is cryptographically broken and unsuitable for security use.",
    remediation: "Replace with SHA-256 (crypto.createHash('sha256')) or bcrypt for passwords.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-008", name: "SHA-1 Hash Usage", severity: "medium",
    pattern: /\bsha1\s*\(|createHash\s*\(\s*["']sha1["']\s*\)/gi,
    message: "SHA-1 is deprecated for cryptographic use (collision attacks known).",
    remediation: "Upgrade to SHA-256 or SHA-3.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-009", name: "eval() Usage", severity: "high",
    pattern: /\beval\s*\([^)]/g,
    message: "eval() executes arbitrary strings as code — major injection risk.",
    remediation: "Remove eval() entirely. Use JSON.parse() for data, or Function constructor with caution.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-010", name: "Weak Math.random()", severity: "low",
    pattern: /Math\.random\s*\(\s*\)/g,
    message: "Math.random() is not cryptographically secure.",
    remediation: "Use crypto.getRandomValues() or crypto.randomUUID() for security contexts.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-011", name: "SQL String Concatenation", severity: "medium",
    pattern: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\s+[^"'`]*\s*\+\s*(?:req|request|params|query|body|input|user)/gi,
    message: "Potential SQL injection via string concatenation.",
    remediation: "Use parameterized queries or prepared statements. Never build SQL from user input.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-012", name: "innerHTML Assignment", severity: "low",
    pattern: /\.innerHTML\s*=/g,
    message: "Direct innerHTML assignment can introduce XSS vulnerabilities.",
    remediation: "Use textContent for plain text, or DOMPurify.sanitize() before setting innerHTML.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-013", name: "document.write()", severity: "medium",
    pattern: /document\.write\s*\(/g,
    message: "document.write() can open XSS attack vectors.",
    remediation: "Use modern DOM manipulation (createElement, appendChild) instead.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-014", name: "Token in Source", severity: "high",
    pattern: /(?:access|auth|bearer|refresh)[_-]?token\s*[=:]\s*["'`]([A-Za-z0-9\-_.]{20,})["'`]/gi,
    message: "Authentication token hardcoded in source.",
    remediation: "Load from environment variables at runtime, not from source code.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-015", name: "Console Log of Sensitive Data", severity: "info",
    pattern: /console\.(?:log|warn|error|debug)\s*\([^)]*(?:password|secret|token|key|auth|credential)[^)]*\)/gi,
    message: "Sensitive variable name appears in console output.",
    remediation: "Remove debug logging of sensitive data before production deployment.",
    languages: ["js", "ts", "auto"],
  },
  {
    id: "SEC-016", name: "Unencrypted HTTP Endpoint", severity: "info",
    pattern: /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])[^"'`\s]+["'`]/gi,
    message: "Non-localhost HTTP (cleartext) endpoint detected.",
    remediation: "Use HTTPS for all production API endpoints.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-017", name: "Dangerous deserialize()", severity: "high",
    pattern: /\bdeserialize\s*\(|pickle\.loads\s*\(/g,
    message: "Unsafe deserialization can lead to Remote Code Execution.",
    remediation: "Validate and sanitize serialized data. Use safe parsers (JSON.parse, not eval).",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-018", name: "Python exec()", severity: "high",
    pattern: /\bexec\s*\(/g,
    message: "exec() executes arbitrary Python code — critical injection risk.",
    remediation: "Remove exec() calls. Use explicit function calls or ast.literal_eval() for safe evaluation.",
    languages: ["py", "auto"],
  },
  {
    id: "SEC-019", name: "GitHub Token", severity: "critical",
    pattern: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/g,
    message: "GitHub Personal Access Token found in source!",
    remediation: "Revoke this token immediately at github.com/settings/tokens. Use GitHub Actions secrets.",
    languages: ["js", "ts", "py", "auto"],
  },
  {
    id: "SEC-020", name: "Slack Webhook/Token", severity: "critical",
    pattern: /xox[baprs]-[A-Za-z0-9\-]{10,}/g,
    message: "Slack API token or webhook found in source.",
    remediation: "Rotate immediately in Slack app settings. Store in environment variables.",
    languages: ["js", "ts", "py", "auto"],
  },
];

function scanCode(payload: ScanCodePayload): ScanResult {
  const t0 = performance.now();
  const { code } = payload;
  const lines = code.split("\n");
  const findings: SecurityFinding[] = [];

  for (const rule of SECURITY_RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = rule.pattern.exec(code)) !== null) {
      const upToMatch = code.substring(0, match.index);
      const lineNum = upToMatch.split("\n").length;
      const col = match.index - upToMatch.lastIndexOf("\n") - 1;
      const lineContent = lines[lineNum - 1]?.trim() ?? "";

      findings.push({
        severity:    rule.severity,
        ruleId:      rule.id,
        ruleName:    rule.name,
        message:     rule.message,
        remediation: rule.remediation,
        line:        lineNum,
        col:         col,
        snippet:     lineContent.length > 100 ? lineContent.substring(0, 100) + "…" : lineContent,
      });
    }
  }

  // Sort: critical → high → medium → low → info
  const sevOrder: SecurityFinding["severity"][] = ["critical", "high", "medium", "low", "info"];
  findings.sort((a, b) => sevOrder.indexOf(a.severity) - sevOrder.indexOf(b.severity));

  // Compute severity counts
  const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) severityCounts[f.severity]++;

  // Risk score: weighted sum / max (100)
  const weights = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
  const rawScore = Math.min(100,
    severityCounts.critical * weights.critical +
    severityCounts.high     * weights.high     +
    severityCounts.medium   * weights.medium   +
    severityCounts.low      * weights.low      +
    severityCounts.info     * weights.info
  );

  return {
    findings,
    scannedLines:   lines.length,
    scannedChars:   code.length,
    scanDurationMs: performance.now() - t0,
    severityCounts,
    riskScore:      rawScore,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV PARSER ENGINE (Streams-compatible, chunked)
// ═══════════════════════════════════════════════════════════════════════════════

function parseCsv(payload: ParseCsvPayload): ParseResult {
  const t0 = performance.now();
  const { text, delimiter = ",", hasHeader = true, maxRows = 500_000 } = payload;

  const lines = text.split(/\r?\n/);
  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, totalCols: 0, fileSizeChars: text.length, parseDurationMs: 0, nullCounts: {}, sample: [] };
  }

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === delimiter && !inQuotes) { cells.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  }

  const rawLines = lines.filter(l => l.trim().length > 0);
  const headers = hasHeader
    ? parseLine(rawLines[0]).map(h => h.replace(/^["']|["']$/g, "").trim())
    : rawLines[0].split(delimiter).map((_, i) => `col_${i + 1}`);

  const dataLines = hasHeader ? rawLines.slice(1) : rawLines;
  const rows: string[][] = [];
  const nullCounts: Record<string, number> = Object.fromEntries(headers.map(h => [h, 0]));

  for (let i = 0; i < Math.min(dataLines.length, maxRows); i++) {
    const row = parseLine(dataLines[i]);
    // Pad short rows, truncate long rows
    while (row.length < headers.length) row.push("");
    const trimmedRow = row.slice(0, headers.length);

    // Count nulls
    trimmedRow.forEach((cell, j) => {
      if (cell === "" || cell.toLowerCase() === "null" || cell.toLowerCase() === "na" || cell.toLowerCase() === "n/a") {
        nullCounts[headers[j]]++;
      }
    });

    rows.push(trimmedRow);
  }

  return {
    headers,
    rows,
    totalRows:      dataLines.length,
    totalCols:      headers.length,
    fileSizeChars:  text.length,
    parseDurationMs: performance.now() - t0,
    nullCounts,
    sample:         rows.slice(0, 5),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function aggregate(payload: AggregatePayload): AggregateResult {
  const { headers, rows, column } = payload;
  const colIdx = headers.indexOf(column);

  if (colIdx < 0) throw new Error(`Column '${column}' not found.`);

  const values: number[] = [];
  const rawValues: string[] = [];
  let nulls = 0;

  for (const row of rows) {
    const cell = row[colIdx];
    if (cell === "" || cell == null) { nulls++; continue; }
    const num = parseFloat(cell);
    if (!isNaN(num)) {
      values.push(num);
    } else {
      rawValues.push(cell);
    }
  }

  // Numeric column
  if (values.length > 0) {
    values.sort((a, b) => a - b);
    const n    = values.length;
    const sum  = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[Math.floor(n / 2)];
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    return { column, count: n, sum, mean, median, min: values[0], max: values[n - 1], stdDev, nulls, topValues: [] };
  }

  // Categorical column
  const freq: Record<string, number> = {};
  for (const v of rawValues) freq[v] = (freq[v] || 0) + 1;
  const topValues = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count }));

  return { column, count: rawValues.length, sum: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0, nulls, topValues };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SQL FILTER ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function filterSql(payload: FilterSqlPayload): FilterResult {
  const t0 = performance.now();
  let { headers, rows } = payload;
  const { sql } = payload;
  const totalRows = rows.length;

  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/is);
  const whereMatch  = sql.match(/WHERE\s+(.+?)(?:\s+(?:LIMIT|ORDER|GROUP)\s|$)/is);
  const limitMatch  = sql.match(/LIMIT\s+(\d+)/i);
  const orderMatch  = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);

  // SELECT columns
  if (selectMatch && selectMatch[1].trim() !== "*") {
    const cols = selectMatch[1].split(",").map(c => c.trim());
    const idxs = cols.map(c => headers.indexOf(c)).filter(i => i >= 0);
    if (idxs.length > 0) {
      headers = idxs.map(i => headers[i]);
      rows = rows.map(r => idxs.map(i => r[i] ?? ""));
    }
  }

  // WHERE
  if (whereMatch) {
    const cond = whereMatch[1].trim();

    // Simple equality: col = 'val'
    const eqMatch   = cond.match(/^(\w+)\s*=\s*['"]?([^'"]+)['"]?$/i);
    const neqMatch  = cond.match(/^(\w+)\s*!=\s*['"]?([^'"]+)['"]?$/i);
    const likeMatch = cond.match(/^(\w+)\s+LIKE\s+['"]?%?([^'"%]+)%?['"]?$/i);
    const gtMatch   = cond.match(/^(\w+)\s*>\s*(\d+(?:\.\d+)?)$/i);
    const gteMatch  = cond.match(/^(\w+)\s*>=\s*(\d+(?:\.\d+)?)$/i);
    const ltMatch   = cond.match(/^(\w+)\s*<\s*(\d+(?:\.\d+)?)$/i);
    const lteMatch  = cond.match(/^(\w+)\s*<=\s*(\d+(?:\.\d+)?)$/i);
    const inMatch   = cond.match(/^(\w+)\s+IN\s+\(([^)]+)\)$/i);
    const nullMatch = cond.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);

    const getColIdx = (name: string) => headers.indexOf(name);

    if (eqMatch) {
      const ci = getColIdx(eqMatch[1]); const v = eqMatch[2].toLowerCase();
      if (ci >= 0) rows = rows.filter(r => r[ci]?.toLowerCase() === v);
    } else if (neqMatch) {
      const ci = getColIdx(neqMatch[1]); const v = neqMatch[2].toLowerCase();
      if (ci >= 0) rows = rows.filter(r => r[ci]?.toLowerCase() !== v);
    } else if (likeMatch) {
      const ci = getColIdx(likeMatch[1]); const v = likeMatch[2].toLowerCase();
      if (ci >= 0) rows = rows.filter(r => r[ci]?.toLowerCase().includes(v));
    } else if (gteMatch) {
      const ci = getColIdx(gteMatch[1]); const v = parseFloat(gteMatch[2]);
      if (ci >= 0) rows = rows.filter(r => parseFloat(r[ci]) >= v);
    } else if (gtMatch) {
      const ci = getColIdx(gtMatch[1]); const v = parseFloat(gtMatch[2]);
      if (ci >= 0) rows = rows.filter(r => parseFloat(r[ci]) > v);
    } else if (lteMatch) {
      const ci = getColIdx(lteMatch[1]); const v = parseFloat(lteMatch[2]);
      if (ci >= 0) rows = rows.filter(r => parseFloat(r[ci]) <= v);
    } else if (ltMatch) {
      const ci = getColIdx(ltMatch[1]); const v = parseFloat(ltMatch[2]);
      if (ci >= 0) rows = rows.filter(r => parseFloat(r[ci]) < v);
    } else if (inMatch) {
      const ci = getColIdx(inMatch[1]);
      const vals = inMatch[2].split(",").map(v => v.trim().replace(/['"]/g, "").toLowerCase());
      if (ci >= 0) rows = rows.filter(r => vals.includes(r[ci]?.toLowerCase()));
    } else if (nullMatch) {
      const ci = getColIdx(nullMatch[1]); const isNot = !!nullMatch[2];
      if (ci >= 0) rows = rows.filter(r => isNot ? r[ci] !== "" && r[ci] != null : r[ci] === "" || r[ci] == null);
    }
  }

  // ORDER BY
  if (orderMatch) {
    const ci = headers.indexOf(orderMatch[1]);
    const desc = orderMatch[2]?.toUpperCase() === "DESC";
    if (ci >= 0) {
      rows = [...rows].sort((a, b) => {
        const av = parseFloat(a[ci]);
        const bv = parseFloat(b[ci]);
        if (!isNaN(av) && !isNaN(bv)) return desc ? bv - av : av - bv;
        return desc ? b[ci].localeCompare(a[ci]) : a[ci].localeCompare(b[ci]);
      });
    }
  }

  // LIMIT
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

  return { headers, rows, matchedRows: rows.length, totalRows, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT CONVERTER
// ═══════════════════════════════════════════════════════════════════════════════

function convertFormat(payload: ConvertFormatPayload): ConvertResult {
  const t0 = performance.now();
  const { headers, rows, format } = payload;
  let content = "";

  switch (format) {
    case "csv":
      content = [headers.join(","), ...rows.map(r => r.map(c => c.includes(",") ? `"${c}"` : c).join(","))].join("\n");
      break;
    case "tsv":
      content = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
      break;
    case "json": {
      const records = rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
      content = JSON.stringify(records, null, 2);
      break;
    }
    case "ndjson": {
      const records = rows.map(r => JSON.stringify(Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))));
      content = records.join("\n");
      break;
    }
  }

  return { content, format, rowCount: rows.length, sizeChars: content.length, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "PING":
        self.postMessage({ type: "PONG" } satisfies WorkerOutMessage);
        break;

      case "SCAN_CODE": {
        // Emit progress
        self.postMessage({ type: "PROGRESS", payload: { stage: "Tokenizing source code…", percent: 10 } } satisfies WorkerOutMessage);
        const result = scanCode(msg.payload);
        self.postMessage({ type: "PROGRESS", payload: { stage: "Scan complete", percent: 100 } } satisfies WorkerOutMessage);
        self.postMessage({ type: "SCAN_RESULT", payload: result } satisfies WorkerOutMessage);
        break;
      }

      case "PARSE_CSV": {
        self.postMessage({ type: "PROGRESS", payload: { stage: "Parsing CSV…", percent: 20 } } satisfies WorkerOutMessage);
        const result = parseCsv(msg.payload);
        self.postMessage({ type: "PROGRESS", payload: { stage: "Parse complete", percent: 100, rowsProcessed: result.totalRows } } satisfies WorkerOutMessage);
        self.postMessage({ type: "PARSE_RESULT", payload: result } satisfies WorkerOutMessage);
        break;
      }

      case "PARSE_JSON": {
        self.postMessage({ type: "PROGRESS", payload: { stage: "Parsing JSON…", percent: 30 } } satisfies WorkerOutMessage);
        const raw = JSON.parse(msg.payload.text);
        const arr = Array.isArray(raw) ? raw : [raw];
        const headers = arr.length > 0 ? Object.keys(arr[0]) : [];
        const rows = arr.map(item => headers.map(h => String(item[h] ?? "")));
        const result: ParseResult = {
          headers, rows,
          totalRows: arr.length, totalCols: headers.length,
          fileSizeChars: msg.payload.text.length,
          parseDurationMs: 0,
          nullCounts: {},
          sample: rows.slice(0, 5),
        };
        self.postMessage({ type: "PARSE_RESULT", payload: result } satisfies WorkerOutMessage);
        break;
      }

      case "AGGREGATE": {
        const result = aggregate(msg.payload);
        self.postMessage({ type: "AGGREGATE_RESULT", payload: result } satisfies WorkerOutMessage);
        break;
      }

      case "FILTER_SQL": {
        const result = filterSql(msg.payload);
        self.postMessage({ type: "FILTER_RESULT", payload: result } satisfies WorkerOutMessage);
        break;
      }

      case "CONVERT_FORMAT": {
        const result = convertFormat(msg.payload);
        self.postMessage({ type: "CONVERT_RESULT", payload: result } satisfies WorkerOutMessage);
        break;
      }

      default:
        self.postMessage({ type: "ERROR", payload: { message: "Unknown message type", code: "UNKNOWN_MSG" } } satisfies WorkerOutMessage);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: "ERROR", payload: { message, code: "WORKER_ERROR" } } satisfies WorkerOutMessage);
  }
};
