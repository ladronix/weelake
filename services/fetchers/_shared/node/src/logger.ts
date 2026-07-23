/**
 * Structured JSON logger for fetchers.
 *
 * Every log line is one JSON object per stdout line so GitHub
 * Actions log aggregation stays parseable, and so a future
 * loki/vector pipeline can ingest without a regex parser.
 *
 * When running locally (TTY detected), we pretty-print to make dev
 * debugging pleasant. Production runs (no TTY, or FORCE_JSON_LOGS=1)
 * emit raw JSON.
 *
 * Log fields ALWAYS present:
 *   ts       — ISO timestamp
 *   fetcher  — the fetcher name (openmeteo, copernicus-lswt, …)
 *   level    — debug | info | warn | error
 *   event    — dot-separated event key (run.start, lake.ok, …)
 *
 * Everything else is a free-form structured payload.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  event: string;
  [key: string]: unknown;
}

const isTTY = process.stdout.isTTY && !process.env.FORCE_JSON_LOGS;

function fmtPretty(fetcher: string, level: LogLevel, fields: LogFields): string {
  const { event, ...rest } = fields;
  const color =
    level === "error" ? "\x1b[31m"
    : level === "warn" ? "\x1b[33m"
    : level === "info" ? "\x1b[36m"
    : "\x1b[90m";
  const reset = "\x1b[0m";
  const bits = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  return `${color}[${level.padEnd(5)}]${reset} ${fetcher} ${event}${bits ? " " + bits : ""}`;
}

function fmtJson(fetcher: string, level: LogLevel, fields: LogFields): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    fetcher,
    level,
    ...fields,
  });
}

export function makeLogger(fetcher: string) {
  const emit = (level: LogLevel, fields: LogFields) => {
    const line = isTTY ? fmtPretty(fetcher, level, fields) : fmtJson(fetcher, level, fields);
    // console.log for info/debug, console.error for warn/error so
    // GitHub Actions colouring reflects severity.
    if (level === "warn" || level === "error") console.error(line);
    else console.log(line);
  };
  return {
    debug: (fields: LogFields) => emit("debug", fields),
    info:  (fields: LogFields) => emit("info",  fields),
    warn:  (fields: LogFields) => emit("warn",  fields),
    error: (fields: LogFields) => emit("error", fields),
  };
}

export type Logger = ReturnType<typeof makeLogger>;
