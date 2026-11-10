# Prototype audit: does each section do its job?

Method: for every section, three questions. Does it answer a precise need? Is it built well? Is it the best way to present the thing? Verdicts are mine, from the browser at 375, 768 and 1280 px, plus the automated checks in `tests/`.

## Home

| Section | Need it answers | Verdict | Fixed now | Still open |
|---|---|---|---|---|
| Hero | Say what Malaconda is, offer one action | Good. Strong line, two coloured words, one primary action | Zoom of the photo works in every browser (JS, not scroll-timeline) | "Brewed in Colombia, bound for the bold" comes from the old site: confirm the claim with the founders |
| Photo + snake badge | Emotion before information | Good | Parallax zoom, badge kept | None |
| Flavour picker | Choose a flavour, know how it tastes and what is in it, buy | Good, with one weak point | One screen tall, cut-out bottle, word behind it with soft pastel fill and parallax, no layout jump between flavours, ingredients added | Ingredient list is invented. On a phone the controls come before the bottle: test whether the bottle should come first. No shipping cost shown |
| Story | Give the brand its mystery | Good. Colour now follows the flavour picked above | Random colour removed. It was my own idea: the block picked yellow or coral at random on load, flipped each time you scrolled back to it, and flipped when you tapped the snake. Nothing told the visitor why, so it read as a bug | "Not everyone gets bitten." now appears on the story, on the ambassador section and on the Ambassadors page. Decide which one keeps it |
| Pros (teaser) | Send venue owners to the Pros page | Good, now sized to its content | Photo recentred, pool-table image used | None |
| Ambassadors (teaser) | Send would-be ambassadors to the page | Good, sized to its content | Coasters photo replaces the image with the misspelt label | None |
| Contact | Let anyone reach the team, knowing what is what | Was weak: two unlabelled links and a void. Now matches the original | Labelled Email and Instagram, form with General, Order, Partner, Press, messages land in the admin | No confirmation copy by design |
| Footer | Navigation and newsletter | Was flat. Now closer to the original | Large logo, turning snake, newsletter, links, theme switch | Newsletter is not stored |

## Pros page
Problem found: the page was a pile of parts (a price, a sentence, a login link, a form) with no order of discovery.
Reasoning: a venue owner arrives with one question, "what do I get and how do I get in?". Order of discovery: promise, benefits, one action. Returning pros need a login, but they are the minority, so the login sits next to the main action as a quiet link.
Result: hero with one button and a quiet "Already a pro? Log in" · three big benefits (wholesale prices, volume pricing, order tracking) · short form under a sentence heading, button "Request access". No hat repeating the page name. Retail price appears once, in the form sentence.
Open: no proof (venues already pouring it). It cannot be invented, so it needs real names from the founders.

## Ambassadors page
Same structure. The hero text is now vertically centred instead of pushed to the bottom. The form heading is a question ("Know the right venues?") so it no longer repeats the button ("Apply").
Open: the rate is confidential, so "Paid on every order" stays vague. Watch whether that costs applications.

## Cart, spaces, admin
- Cart: works, no payment, no shipping cost, VAT not itemised.
- Customer, Pro, Ambassador spaces: complete for the prototype. The "View as" menu replaces login.
- Admin: overview, requests (now including contact messages), customers, pro accounts, orders, ambassadors, commissions, settings.

## Cross-cutting
- Contrast: muted small text (`--graphite` on the grey page) is about 4:1, below the 4.5:1 AA target. To fix when colours are final.
- Motion: parallax and reveals respect "reduce motion".
- Tests: 30 automated checks (pricing, referral and commission rules, broken files, copy rules, brand rules). Swipe, parallax, themes and layout were checked by hand in the browser. There is no automated browser test yet.
