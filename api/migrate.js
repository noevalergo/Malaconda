/* Creates the database (if allowed) and the tables. Safe to run again. */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const config = require("./config");

async function migrate() {
  const { database, ...conn } = config.db;
  const c = await mysql.createConnection({ ...conn, multipleStatements: true });
  try {
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
    await c.query(`USE \`${database}\``);
    await c.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  } finally { await c.end(); }
  console.log(`Database "${database}" is ready.`);
}
if (require.main === module) migrate().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = migrate;
