import { PaymentMethod } from './enums';

/**
 * TapNTally Bill Exchange Format (TBEF).
 *
 * This is the payload a POS terminal writes onto an NFC tag / emits via HCE
 * after a sale. It is the integration contract we hand to terminal partners
 * (Paytm, Pine Labs, bank-issued machines), so it is versioned and every
 * breaking change bumps `v`.
 *
 * Transport: an NDEF record with MIME type `application/vnd.tapntally.bill+json`
 * containing UTF-8 JSON matching `TbefBillV1`. Optional HMAC-SHA256 signature
 * lets the backend verify the bill originated from an enrolled terminal.
 */

export const TBEF_MIME_TYPE = 'application/vnd.tapntally.bill+json';
export const TBEF_CURRENT_VERSION = 1;

export interface TbefLineItem {
  /** Human-readable item name as printed on the receipt. */
  name: string;
  /** Quantity; may be fractional for weighed goods (e.g. 0.75 kg). */
  qty: number;
  /** Unit price in integer paise. */
  unitPaise: number;
  /** Line total in integer paise (qty * unitPaise, after line-level discount). */
  totalPaise: number;
  /** Optional merchant SKU / barcode — useful for future product-level insights. */
  sku?: string;
  /** Optional GST rate applied to this line, as a percentage (e.g. 18). */
  gstRate?: number;
}

export interface TbefMerchant {
  /** Display name, e.g. "Reliance Fresh - Koramangala". */
  name: string;
  /** Partner-assigned merchant identifier. Stable across bills. */
  merchantId?: string;
  /** GSTIN when available — strongest signal for merchant identity. */
  gstin?: string;
  /** Merchant Category Code (ISO 18245) when the terminal knows it. */
  mcc?: string;
  /** Free-text address line for the receipt. */
  address?: string;
}

export interface TbefTerminal {
  /** Partner network identifier, e.g. "paytm", "pinelabs", "hdfc". */
  network: string;
  /** Partner's unique terminal id (TID). */
  terminalId: string;
}

export interface TbefBillV1 {
  /** Schema version. Always 1 for this shape. */
  v: 1;
  /** Partner-side bill / invoice number. Used for idempotent dedupe. */
  billId: string;
  /** ISO-8601 timestamp of the sale in the terminal's local time with offset. */
  issuedAt: string;
  /** ISO-4217 currency. Only "INR" is accepted today. */
  currency: 'INR';
  merchant: TbefMerchant;
  terminal: TbefTerminal;
  items: TbefLineItem[];
  /** Sum of line totals before tax/discount, integer paise. */
  subtotalPaise: number;
  /** Total tax, integer paise. */
  taxPaise: number;
  /** Bill-level discount, integer paise (positive number). */
  discountPaise: number;
  /** Final amount paid, integer paise. Must equal subtotal + tax - discount. */
  totalPaise: number;
  paymentMethod: PaymentMethod;
  /** Base64 HMAC-SHA256 over the canonical JSON (see backend `tbef-signature.ts`). */
  sig?: string;
}

/** Union of all supported versions; extend when v2 lands. */
export type TbefBill = TbefBillV1;
