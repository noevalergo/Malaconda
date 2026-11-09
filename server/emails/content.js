/**
 * EDITABLE EMAIL CONTENT
 *
 * Texts the business can change without touching the email logic:
 * product information, storage, delivery and ambassador information that
 * appear in confirmation emails.
 *
 * TODO (business): replace every "[to be provided]" with the real text
 * before going live. Nothing here is invented: these are placeholders.
 */
export const EMAIL_CONTENT = {
  brandName: "MALACONDA",
  signature: "The MALACONDA team",

  b2cConfirmation: {
    productInfo: "[to be provided: ingredients and product information]",
    storage: "[to be provided: storage instructions]",
    delivery: "[to be provided: delivery information for Switzerland]",
  },

  b2bConfirmation: {
    nextSteps:
      "Your allocation becomes binding on 28 February 2027. Delivery is planned for early April 2027; the remaining 80% is paid upon delivery.",
    partnerKit: "[to be provided: partner kit details]",
  },

  invoiceInstructions: "[to be provided: how and when the 20% deposit invoice is sent, bank details]",
};
