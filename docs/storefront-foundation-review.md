# Phase 35 storefront foundation review

Phase 35 introduces the customer design foundation from `instructions4.md`. It does not accept the storefront for release or implement the later page redesigns. The design contract is [storefront-design.md](storefront-design.md).

## Scope and integration

The isolated `ui-overhaul-phase35-foundation` branch contains the Phase 34 audit and Phase 35 foundation on committed integration baseline `803970d`. After the user's independent rebase finished, only our separate branch was rebased. Header/product conflicts retain the functional cart context and add-item handler. The original worktree's uncommitted backend, proxy, account and abort-handling work was not imported, committed or overwritten. No force-push or merge into the user's working branch is part of delivery.

Customer colors, fonts, spacing, radii, borders, surfaces, focus, shadows and timing are centralized in `apps/web/styles/storefront.css`. Catalog/search, cart, checkout and the existing cart drawer consume scoped tokens. Operational root tokens and auth/account presentation are retained. Shared consumer controls/content/feedback reuse precise money and native dialog behavior. New price displays use actual currency and decimal strings; discounts use BigInt arithmetic. All 17 required primitive categories are documented. Existing workflows retain their handlers, backend authority and API contracts.

## Browser evidence

Standalone existing Python Playwright/Chromium ran against our preview at `http://127.0.0.1:3001`, with the actual development API and anonymous browser state. Viewports were **375, 430, 768, 1024, 1440 and 1920px**, each 900px high, device scale 1. Route captures used `en-US` and UTC. These are development screenshots; Next.js's development indicator is visible. No catalog, account, order or payment fixtures were seeded, and no add-item, order or payment mutations were submitted. Existing development data supplied the Gadgets category and two products without images.

The [capture report](storefront-audit/phase35/capture-report.json) records **72 route/width combinations**: home, shop, three unavailable-ID routes, cart, checkout, no-order payment, no-order success, and existing category/product/seller destinations discovered from actual links. Six homepage viewport images, one mobile menu, six existing cart drawers and twelve component-only overlay captures produce **97 final captures**. Thirty representative PNGs and reports are retained in `docs/storefront-audit/phase35`; the full capture set remains in ignored `.artifacts/storefront-phase35`. Reports include filenames of local images beyond the retained subset.

Inspected all six homepage viewport screenshots; full home at 1440; shop at 768/1440; actual category/product/seller destinations at 430; cart at 430/1440; checkout at 375; no-order payment at 430; no-order success at 1440; mobile menu and existing cart drawer at 375; cart drawer at 1440; and customer modal at 430 and drawer at 1440. Other captures received automated measurements, not individual visual inspection.

Representative evidence:

- [Home, 375](storefront-audit/phase35/home-viewport-375.png), [430](storefront-audit/phase35/home-viewport-430.png), [768](storefront-audit/phase35/home-viewport-768.png), [1024](storefront-audit/phase35/home-viewport-1024.png), [1440](storefront-audit/phase35/home-viewport-1440.png), [1920](storefront-audit/phase35/home-viewport-1920.png).
- [Shop, 768](storefront-audit/phase35/shop-768.png), [shop, 1440](storefront-audit/phase35/shop-1440.png), [actual category, 430](storefront-audit/phase35/category-existing-430.png).
- [Apparent empty cart, 430](storefront-audit/phase35/cart-430.png), [checkout fallback, 375](storefront-audit/phase35/checkout-375.png), [existing cart drawer, 375](storefront-audit/phase35/cart-drawer-375.png).
- [Modal fixture, 430](storefront-audit/phase35/fixture-modal-430.png), [drawer fixture, 1440](storefront-audit/phase35/fixture-drawer-1440.png).
- [Existing product error](storefront-audit/phase35/product-existing-430.png), [existing seller error](storefront-audit/phase35/seller-existing-430.png), [unsupported no-order confirmation](storefront-audit/phase35/success-no-order-1440.png).

## Observations and acceptance limits

The customer canvas is cream, actions use darker copper, and hero/footer surfaces are espresso. Editorial headings use Georgia; commerce text uses Segoe UI/system fonts. Product cards retain actual titles, sellers, availability and exact USD prices. Missing imagery is explicitly named, with stable square geometry. Footer text remains readable on espresso. Operational login has no customer boundary and retains the original `--ui-accent: #176b57`.

At 375px the document measures **388px**, with the menu clipped and Sign In wrapping. The Phase 34 baseline already measured 395px at this width; this existing header composition still needs Phase 36. All captured widths from 430px upwards fit the viewport. The 768px filter rail compresses price inputs and the footer brand; later shell/listing phases must resolve intrinsic sizing. The homepage still has a large empty hero region, extensive vertical spacing and unsupported merchandising promises; composition/copy belong to Phase 37. No overflow-hiding workaround was added.

Actual category products render, but existing product/seller destinations show “signal is aborted without reason” in development. The committed baseline's effects treat Strict Mode cancellation as an error; the user has independent uncommitted fixes. These captures establish error-theme presentation, not populated PDP/seller acceptance.

Fresh [proxy probes and drawer measurements](storefront-audit/phase35/cart-drawer-report.json) confirm `/api/v1/cart/` and `/api/v1/checkout/addresses/` return 308, whereas `/api/v1/cart` returns 200. Browser cart requests fail with `net::ERR_FAILED`; expected Strict Mode/navigation cancellations are separately recorded as `net::ERR_ABORTED`. The baseline cart load suppresses its failure, so apparently empty cart/checkout screenshots do not prove successfully loaded commerce state. Redirect rejection remains intact; the user's uncommitted proxy fix is not part of this branch.

The baseline no-order success route still claims `ORD-SUCCESS`, payment/receipt and delivery without order evidence. Existing cart arithmetic uses floats and hardcoded shipping previews; the PDP reports add-item success before acceptance. These are inherited functional blockers already recorded in Phase 34, not foundation completion claims. Payment form tokenization, synchronous submission guard and idempotency keys remain unchanged. Existing cart/filter overlays have not been migrated to the new native wrapper; their accessibility debt remains for the authorized later phases.

## Component and code validation

The new consumer modal/drawer wrapper was exercised in a temporary component-only route with no backend fixture. All **12 kind/width cases** passed native modal state, ten forward and ten reverse Tab presses without leaving the dialog, Escape, trigger focus return, scroll restoration, busy Escape protection and busy Tab containment. The [overlay report](storefront-audit/phase35/overlay-report.json) records geometry and results. The temporary route was removed before the final production build and commit. These results apply to the new wrapper, not the existing cart/filter overlays.

Reduced-motion emulation produces zero active animations and zero transition timing. Twenty-two actual palette pairings pass [contrast validation](storefront-audit/phase35/contrast-report.json), including essential control borders and dark-section text. This is token/component evidence, not a whole-page accessibility certification.

The foundation adds eleven unit checks for controls, validation semantics, quantity bounds, exact large/fractional amounts, discounts, image evidence, ratings, breadcrumbs, overlay focus/busy behavior and persistent notifications. Customer integration assertions retain variant/quantity/API checks and require actual currency labels. An existing staff error-focus assertion still requires the same focused rejection after its passive effect. A temporary TypeScript syntax comparison of the six migrated cart/checkout files, ignoring styling and JSX formatting whitespace, confirmed their non-style code matches `803970d`.

Final repository gates and results are recorded in [progress.md](progress.md). The [production route audit](storefront-audit/phase35/build-report.json) excludes the deleted fixture and covers 59 source pages; artifact measurements do not establish browser performance, hydration or Core Web Vitals.

Safari/Firefox, assistive technology, touch devices, zoom/reflow, authenticated account states, populated cart/checkout/payment, real product imagery and performance acceptance remain pending. Phase 35 foundation completion does not clear those release gates. Phase 36 covers the header, search, navigation and footer after another explicit request. STOP after Phase 35.
