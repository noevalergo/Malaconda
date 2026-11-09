/**
 * Read helpers for the Google Sheets report (read-only, plus the
 * "sheetsSyncedAt" marker on orders).
 */
import { COL } from "./firestore.js";

export { COL };

export async function getDocData(db, collection, id) {
  const snap = await db.collection(collection).doc(id).get();
  return snap.exists ? { id: snap.id, data: snap.data() } : null;
}

export async function listAll(db, collection) {
  const snap = await db.collection(collection).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

export async function paymentsOfOrder(db, orderRef) {
  const snap = await db.collection(COL.payments).where("orderRef", "==", orderRef).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

export async function markOrderSynced(db, orderRef) {
  await db.collection(COL.orders).doc(orderRef).update({ sheetsSyncedAt: new Date() });
}
