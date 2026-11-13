/* Creates the database (if allowed) and the tables. Safe to run again. */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const config = require("./config");

const ADDED_COLUMNS = [
  ["orders", "delivery_method", "VARCHAR(8) NOT NULL DEFAULT 'ship'"],
  ["orders", "shipping_cents", "INT UNSIGNED NOT NULL DEFAULT 0"],
];

async function migrate() {
  const { database, ...conn } = config.db;
  const c = await mysql.createConnection({ ...conn, multipleStatements: true });
  try {
    try { await c.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`); } catch (e) { /* on shared hosting the database exists already and cannot be created by the app user */ }
    await c.query(`USE \`${database}\``);
    await c.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
    // columns added after the first release: CREATE TABLE IF NOT EXISTS does not add them to an existing table
    for (const [table, column, ddl] of ADDED_COLUMNS) {
      const [rows] = await c.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?", [database, table, column]);
      if (!rows[0].n) await c.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
    }
  } finally { await c.end(); }
  console.log(`Database "${database}" is ready.`);
}
if (require.main === module) migrate().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = migrate;
