# Account, price and rights model (one source of truth)

Reviewed by an independent agent; its findings are folded in (section 10). Every number is a starting value editable in the admin. Everything the site shows (prices, discounts, credit, commissions) is computed from this model by one engine, never typed in a screen.

## 1. Units
- Price unit: **CHF per bottle**, stored in cents. A **box = 12 bottles of 20 cl**. Orders are in boxes.
- Screens show the **box price and the total as primary figures**. Per-bottle figures are shown for list and negotiated prices only (exact), and marked "about" on tier rows (a tier discount can land between two cents).
- Retail (public): CHF 39.00 per box, VAT included. Pro prices and pro totals are **excluding VAT**. VAT rate in Settings: 8.1% (informational: used for invoices and for the price invariant). Shipping is outside the discount base.

## 2. Prices
| Item | Starting value | Where it lives |
|---|---|---|
| Pro list price | CHF 2.20 per bottle = CHF 26.40 per box, both flavours | Settings |
| Negotiated price | Optional, per pro, per flavour, per bottle, to the cent. Replaces the list price as that pro's base | Pro account, admin |
| Price floor | CHF 1.80 per bottle, applies to the negotiated base | Settings |
| Ceiling | A negotiated price is never above the list price | Rule |

Rules:
- Only founders set negotiated prices. Every change is logged (date, who, old to new, reason).
- A pro sees only their own prices. An ambassador never sees a unit price.
- **Price invariant** (checked when saving Settings): the list box price (ex VAT) stays below the consumer first-order price ex VAT: `retail / (1 + VAT) × (1 − 15%)` = CHF 30.67 per box. Saving a list price above the floor change, or a floor above any negotiated price, lists the affected pros and is refused until fixed.
- The floor is on the base price. The admin shows each pro's **best-case effective price** (base × best tier × max credit) so founders see what the combined discounts can reach.

## 3. Discounts on a pro order (sequential)
1. `base` = Σ boxes of each flavour × 12 × that pro's price for that flavour.
2. Volume tier on the whole order, by total boxes: 1 to 9: 0%, 10 to 20: 5%, 21 and above: 10%. (Per-pro flag "tiers apply", default yes.)
3. One extra discount, never two: the **welcome offer 10%** if it is the pro's first non-cancelled order, otherwise the **referral credit** available (max 15% per order). (Per-pro flag "welcome and credit apply", default yes.)
- Negotiated prices combine with tiers and extras unless a flag says otherwise. Example: Hotel Selva has a negotiated price and "welcome and credit apply" switched off.
- The order stores the unit prices and percentages it was priced with. A later price change never changes an existing order.
- Welcome offer is consumed when the **order is created** (not at the request). The pro screen says "applies to your first confirmed order".

## 4. Referral credit between pros
- A referred pro qualifies the referrer when their **first paid** order has at least 10 boxes (the "qualifying threshold", not an order minimum). The referrer earns 5% of credit, **recorded in a ledger with its percentage at that moment**.
- Credits stack. At most 15% used per order, the rest carries over. 3 qualified = 15%, 4 qualified = 20% (15% then 5%).
- Cancelling an order releases the credit it used. Cancelling a referred pro's qualifying paid order revokes that ledger entry.
- A pro's first order takes the welcome offer (credit waits). Credit is a discount, never cash.
- Self-referral and loops (A refers B, B refers A) are refused. A pro can be both referred by an ambassador and a referrer of other pros. The ambassador earns nothing on those pros' orders.
- Changing the source later does not remove credit already in the ledger.

## 5. Ambassador commission
- **Decision:** the base is the **net invoiced amount excl. VAT** (after negotiated price, tier, welcome or credit, excl. shipping). A negotiated price therefore lowers the commission. 5% for 12 months from the venue's first paid order (counted even if that order is cancelled later). Rate and duration can be set per ambassador.
- A paid order that is cancelled gives a negative line in the month of the cancellation.
- One source per pro account (ambassador, referring pro, or nobody). The order keeps the ambassador in force when it was created. Source changes are logged.
- The ambassador sees only the venue, the commissionable revenue and the commission.

## 6. Who sees what
| Profile | Public site while logged in | Own space | Cannot |
|---|---|---|---|
| Unlogged visitor | Retail prices, guest checkout | None | See any pro price |
| Logged visitor (customer) | Retail prices, 15% first order | Orders, delivery details | See any pro price |
| New pro | Own prices in real time on the flavour picker, tier table, welcome 10% flagged | My prices, My orders, Recommend, Account | Check out online |
| Pro with referral credit | Same, credit applied to the next order | Same, with credit earned, used, available | Check out online |
| Pro with negotiated prices | Own negotiated prices everywhere | Same | See the list price |
| Ambassador | Public site as a visitor | Venues, statements, code and link, account | See prices, discounts, lines |
| Founders | Everything | Admin | None |

## 7. Pros do not order from their space
- A logged-in pro sees their prices and a live total for any quantity on the site. No cart, no online payment.
- The pro presses **Request this order**. This stores an **order request** with the boxes, the unit prices and the quoted total.
- In the admin, the founder presses **Create order**. If the current pricing differs from the quote, the difference is shown and the founder confirms. Then: invoice sent, paid (bank transfer), shipped, delivered.
- Founders can also create an order directly (phone, email, visit). Both paths use the same engine.
- Admin Requests tab has filters: Access, Ambassadors, Orders, Messages.

## 8. Admin rights
- Create pro accounts; choose the source; edit company details.
- **Prices on a pro**: list price for reference, negotiated price per flavour (blank = list), box price and saving in %, flags (tiers apply, welcome and credit apply), reason, change log.
- **Conditions summary** on every pro: prices, best-case effective price, tier table applied, welcome used or available, credit earned, used, available, source, commission window.
- Settings: list price, floor, VAT, tiers, welcome offers, referral, commission defaults.

## 9. Example profiles (the prototype shows exactly these)
| Profile | Prices | Source | History and conditions |
|---|---|---|---|
| Bar Cobra (Zurich) | List 2.20 | Camila | Orders: 12 boxes (first, welcome, paid Aug 12), 24 boxes (paid Sep 25). Referred Club Anaconda, Vinyl Room, Bodega Norte (all qualified in Oct and Nov), Cafe Lulo (below threshold). **Credit: 15% earned, 0% used, 15% available** |
| Terraza 7 (Bern) | List 2.20 | Luca | New. No orders. Welcome 10% on its first confirmed order |
| Hotel Selva (Geneva) | **Negotiated 2.10** both flavours (box 25.20) | Camila | Tiers apply, welcome and credit do not. Orders: 30 boxes, 15 boxes |
| Club Anaconda (Basel) | List 2.20 | Bar Cobra | First order 10 boxes, paid Oct 10 |
| Vinyl Room (Zurich) | List 2.20 | Bar Cobra | First order 12 boxes, paid Nov 7 |
| Bodega Norte (Lucerne) | List 2.20 | Bar Cobra | First order 10 boxes, paid Oct 15 |
| Cafe Lulo (Lausanne) | List 2.20 | Bar Cobra | First order 4 boxes, paid Oct 20: below the 10-box qualifying threshold |
| Anna Keller | Retail | none | Customer. 3 orders, the first used the 15% offer |

Ambassadors: Camila (Bar Cobra, Hotel Selva), Luca (Terraza 7). Both 5% for 12 months. Menu views: Unlogged visitor, Logged visitor, New pro (Terraza 7), Pro with referral credit stacked (Bar Cobra), Pro with negotiated prices (Hotel Selva), Ambassador (Camila), Admin.

## 10. Decisions after the independent review
1. Spec sections on pro ordering, pro price and the pro tabs rewritten to this model.
2. Prices in cents per flavour; floor, ceiling and invariant added; unit prices stored on every order.
3. Request stores the quote; creating the order shows any difference; welcome consumed at order creation.
4. Credit ledger with percentage at qualification; cycles and self-referral refused; cancel effects defined.
5. Floor applies to the negotiated base and the admin shows the best-case effective price. Per-pro flags for tiers and for welcome/credit. Commission base confirmed as net. VAT 8.1% in Settings, shipping outside the discount base. One account per email per role.
