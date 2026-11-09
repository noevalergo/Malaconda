/**
 * Minimal structured logger: one JSON line per event.
 * Hostinger shows stdout/stderr in the Node.js app logs.
 * Rule: log order references and codes of events, never personal data,
 * card data, verification codes or secrets.
 */
export function createLogger({ silent = false } = {}) {
  const write = (level, event, data) => {
    if (silent) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...data });
    (level === "error" ? console.error : console.log)(line);
  };
  return {
    info: (event, data = {}) => write("info", event, data),
    warn: (event, data = {}) => write("warn", event, data),
    error: (event, data = {}) => write("error", event, data),
  };
}
