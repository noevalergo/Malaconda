/* Empties every table of the database named in the environment: accounts, passwords, sessions, orders, pro accounts, contact messages, payment events.
   For the day the new site goes live (nothing created while testing may stay), or to start a test over. The tables themselves are kept.
   Run:  npm run reset:data -- --yes        (without --yes it only shows what would be deleted) */
const config = require("./config");
const db = require("./db");

const ORDER = ["pro_order_lines", "pro_orders", "pro_sessions", "pros", "order_lines", "orders", "sessions", "users", "stripe_events", "contact_requests"];   // children before parents

async function main() {
  const yes = process.argv.includes("--yes");
  console.log(`Database "${config.db.database}" on ${config.db.host}${config.production ? "  [PRODUCTION]" : ""}`);
  let total = 0;
  for (const t of ORDER) { const n = (await db.one(`SELECT COUNT(*) AS n FROM \`${t}\``)).n; total += n; console.log(`  ${t.padEnd(16)} ${n}`); }
  if (!yes) { console.log("\nNothing deleted. Add --yes to delete all of the above."); return; }
  for (const t of ORDER) await db.query(`DELETE FROM \`${t}\``);
  console.log(`\nDeleted ${total} rows. The database is empty.`);
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => db.close());
