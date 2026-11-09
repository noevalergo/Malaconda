/**
 * Google Sheets client (reporting only).
 *
 * - The spreadsheet must be shared (Editor) with the service account email.
 * - Tabs are created automatically with a header row if missing.
 * - Rows are UPSERTED by the key in column A: an existing row is updated,
 *   otherwise a new row is appended. Retried events never duplicate rows.
 * - Calls are queued one after another (one process), so two updates of the
 *   same key can't both append.
 */
import { auth as googleAuth, sheets as sheetsApi } from "@googleapis/sheets";

export function createSheetsClient({ spreadsheetId, serviceAccount }) {
  if (!spreadsheetId || !serviceAccount) return { enabled: false };

  const auth = new googleAuth.GoogleAuth({
    credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const api = sheetsApi({ version: "v4", auth });
  const knownTabs = new Set();
  let queue = Promise.resolve();

  const enqueue = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  async function ensureTab(tab, headers) {
    if (knownTabs.has(tab)) return;
    const meta = await api.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
    const titles = meta.data.sheets.map((s) => s.properties.title);
    if (!titles.includes(tab)) {
      await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
    }
    await api.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    knownTabs.add(tab);
  }

  return {
    enabled: true,

    upsert(tab, headers, row) {
      return enqueue(async () => {
        await ensureTab(tab, headers);
        const keys = await api.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:A` });
        const index = (keys.data.values || []).findIndex((r) => r[0] === row[0]);
        if (index > 0) {
          await api.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tab}'!A${index + 1}`,
            valueInputOption: "RAW",
            requestBody: { values: [row] },
          });
        } else {
          await api.spreadsheets.values.append({
            spreadsheetId,
            range: `'${tab}'!A1`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [row] },
          });
        }
      });
    },

    /** Replaces a whole tab (used by "Resync Google Sheets"). */
    rewrite(tab, headers, rows) {
      return enqueue(async () => {
        await ensureTab(tab, headers);
        await api.spreadsheets.values.clear({ spreadsheetId, range: `'${tab}'!A2:ZZ` });
        if (rows.length) {
          await api.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tab}'!A2`,
            valueInputOption: "RAW",
            requestBody: { values: rows },
          });
        }
      });
    },
  };
}
