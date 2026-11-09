/**
 * B2B partner applications and approval.
 * partners/{customerId}: same ID as the customer record of the contact person.
 */
import { FieldValue } from "firebase-admin/firestore";
import { COL } from "./firestore.js";

export async function getPartner(db, customerId) {
  const snap = await db.collection(COL.partners).doc(customerId).get();
  return snap.exists ? { customerId: snap.id, ...snap.data() } : null;
}

/**
 * Saves (or re-submits) an application. An APPROVED partner keeps its status;
 * only the contact details are updated.
 */
export async function savePartnerApplication(db, customerId, details, now = new Date()) {
  const ref = db.collection(COL.partners).doc(customerId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data().approvalStatus === "APPROVED") {
      tx.update(ref, { ...details, updatedAt: now });
      return { status: "APPROVED", isNew: false };
    }
    tx.set(ref, {
      ...details,
      approvalStatus: "PENDING",
      approvedAt: null,
      approvedBy: null,
      createdAt: snap.exists ? snap.data().createdAt : now,
      updatedAt: now,
    });
    return { status: "PENDING", isNew: !snap.exists };
  });
}

/** @param {"APPROVED"|"REJECTED"} status */
export async function setPartnerApproval(db, customerId, status, adminEmail, now = new Date()) {
  const ref = db.collection(COL.partners).doc(customerId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.update(ref, {
      approvalStatus: status,
      approvedAt: status === "APPROVED" ? now : null,
      approvedBy: adminEmail,
      updatedAt: now,
      adminLog: FieldValue.arrayUnion({ action: status, by: adminEmail, at: now }),
    });
    return { customerId, ...snap.data(), approvalStatus: status };
  });
}

export async function listPartners(db, { status } = {}) {
  let q = db.collection(COL.partners);
  if (status) q = q.where("approvalStatus", "==", status);
  const snap = await q.orderBy("createdAt", "desc").limit(200).get();
  return snap.docs.map((d) => ({ customerId: d.id, ...d.data() }));
}
