/* The only file that talks to MySQL. Everything else calls these helpers. */
const mysql = require("mysql2/promise");
const config = require("./config");

let pool = null;
function getPool() {
  if (!pool) pool = mysql.createPool({ ...config.db, waitForConnections: true, connectionLimit: 8, timezone: "Z", decimalNumbers: true });
  return pool;
}
const query = async (sql, params) => (await getPool().query(sql, params))[0];
const one = async (sql, params) => (await query(sql, params))[0] || null;

// run several statements together: all succeed or none does
async function tx(fn) {
  const c = await getPool().getConnection();
  try {
    await c.beginTransaction();
    const q = async (sql, params) => (await c.query(sql, params))[0];
    const out = await fn(q);
    await c.commit();
    return out;
  } catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}
async function close() { if (pool) { await pool.end(); pool = null; } }
module.exports = { query, one, tx, close, getPool };
