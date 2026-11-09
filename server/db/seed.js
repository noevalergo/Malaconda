import { COL } from "./firestore.js";
import { welcomePromo } from "./promotions.js";
import { PROMO_RULES } from "../config/catalog.js";

/** Creates promoCodes/WELCOME20 if missing. @returns {Promise<boolean>} created */
export async function seedWelcomeCode(db) {
  const ref = db.collection(COL.promoCodes).doc(PROMO_RULES.welcome.code);
  try {
    await ref.create(welcomePromo(new Date()));
    return true;
  } catch (err) {
    if (err.code === 6 /* ALREADY_EXISTS */) return false;
    throw err;
  }
}
