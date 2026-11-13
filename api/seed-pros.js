/* Demo pro accounts on the server, matching the prototype's demo pros (same emails, password "demo"). For staging and local tests only:
   run `npm run seed:pros`. It refuses to run in production. Safe to repeat (updates the same accounts). */
const config = require("./config");
const db = require("./db");
const migrate = require("./migrate");
const L = require("./lib");

const PROS = [
  { email: "bar@cobra.demo", name: "Bar Cobra", contact: "Nora Keller", address: "Langstrasse 12", zip: "8004", city: "Zurich", credit_pct: 5 },                  // referral credit still available
  { email: "hotel@selva.demo", name: "Hotel Selva", contact: "Julien Roy", address: "Rue du Rhône 8", zip: "1204", city: "Geneva", price_lulo: 2.1, price_guava: 2.1, extras: 0 },   // negotiated price, no welcome or credit
  { email: "club@anaconda.demo", name: "Club Anaconda", contact: "Marc Frei", address: "Steinenvorstadt 3", zip: "4051", city: "Basel" },
  { email: "terraza@seven.demo", name: "Terraza 7", contact: "Sofia Lenz", address: "Aarbergergasse 21", zip: "3011", city: "Bern" },                         // new: welcome offer
];

async function seed() {
  if (config.production) throw new Error("Demo pros are never created in production.");
  await migrate();
  for (const p of PROS) {
    const d = { price_lulo: null, price_guava: null, tiers: 1, extras: 1, credit_pct: 0, phone: "", ...p };
    await db.query(
      `INSERT INTO pros (email, name, contact, phone, password_hash, address, zip, city, price_lulo, price_guava, tiers, extras, credit_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), contact = VALUES(contact), address = VALUES(address), zip = VALUES(zip), city = VALUES(city), price_lulo = VALUES(price_lulo), price_guava = VALUES(price_guava), tiers = VALUES(tiers), extras = VALUES(extras), credit_pct = VALUES(credit_pct)`,
      [d.email, d.name, d.contact, d.phone, L.hashPassword("demo"), d.address, d.zip, d.city, d.price_lulo, d.price_guava, d.tiers, d.extras, d.credit_pct]);
  }
  console.log(`${PROS.length} demo pros ready (password "demo").`);
  await db.close();
}
seed().catch((e) => { console.error(e.message); process.exit(1); });
