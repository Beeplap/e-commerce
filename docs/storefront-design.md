# Customer storefront design foundation

## Checkout composition (Phase 41)

`styles/storefront-checkout.css` uses the existing customer tokens for an editorial heading, plain numbered contact/address/delivery sections and one tan order summary. The summary is sticky beside the desktop form and stacks after mobile details; complete item and server amount evidence remains available. Native address/shipping radios, inline field errors, first-invalid focus, distinct pending/retry/empty states and explicit guest payment review keep the workflow legible. Large amounts move below item descriptions rather than squeezing product names; long seller headings wrap at their source. Payment and verified confirmation share the shell without inventing paid status, shipping guarantees or receipt emails. The gateway is labeled mock. No operational token, backend, API, authentication or payment authority changes. See [Phase 41 evidence and critique](storefront-checkout-review.md).

## Cart composition (Phase 40)

The customer-only `styles/storefront-cart.css` styles quiet seller groups and complete item rows. Mobile uses contained square thumbnails and stacked option/price/quantity controls; desktop adds one tan summary and legible line subtotals. Exact currency and subtotal stay visible without invented shipping/tax/discount charges. Copper identifies checkout; rejected/pending/unavailable states use semantic styling and genuine disabled controls. An eligibility preview is separated from amounts and never claims coupon application. Empty/error/loading states are distinct and provide real shopping/retry routes. Long content wraps; missing/broken thumbnails use accessible icons. The right native drawer shares rows and summary with contained scrolling, visible close/focus, Escape/opener return and cart-local Tab cycling. There is no fixed mobile checkout bar or operational token override. See [Phase 40 evidence and critique](storefront-cart-review.md).

## Product-detail composition (Phase 39)

`styles/storefront-detail.css` consumes the existing customer tokens only. The PDP uses a gallery/purchase split from 768px, with identity/gallery/purchase stacked on mobile. Square images contain the complete photograph; a genuine absent-image state uses a quieter 4:3 panel. Native thumbnail/option buttons have visible pressed focus/state, explicit unavailable wording and at least 44px control geometry. A single SKU does not become a redundant option card. Copper purchase feedback waits for the existing provider; failure is focused inline and success follows acceptance. There is no fixed mobile bar, new gradient, global token override, zoom library or fabricated trust claim.

Details/specifications use plain rows and whitespace; seller discovery uses one tonal band; reviews use dividers rather than floating cards. Exact prices/currency remain prominent, prior prices are strictly higher and long strings wrap. Extremely long h1 names use a smaller display size and remain complete; the repeated breadcrumb current title abbreviates visually. Anchor sections clear the existing sticky header and accept native keyboard destination focus. Existing API evidence constrains every seller, review, image, stock and delivery statement. Related products show up to four actual same-category records with independent recovery. Actual/fixture critique and screenshots are in [the Phase 39 review](storefront-product-detail-review.md); that phase did not include the later cart, checkout or account work.

Phase 35 implements the foundation, Phase 36 the customer header/search/navigation/footer, Phase 37 the homepage, Phase 38 listing discovery, Phase 39 product detail, Phase 40 cart and Phase 41 existing checkout from the user-supplied `instructions4.md`. Seller and account redesign belong to later explicit phases. The token source of truth is `apps/web/styles/storefront.css`; customer components and their scoped styles consume its semantic tokens instead of embedding brand hex values.

## Theme and integration boundary

The `.sf-storefront` ancestor opts a customer surface into the theme. Variables use the `--sf-*` namespace; Tailwind aliases use `sf-*`. There are no customer overrides on `:root`, `body`, or operational `--ui-*` tokens. Home, search, category, product, seller-store, cart and checkout pages include the boundary, including loading/error states. The existing cart drawer has its own transparent theme boundary because it renders outside page roots. Customer auth/account retain their operational presentation until Phase 42. Seller/admin styles and backend/API/auth code are untouched.

Phase 37 work is isolated on `ui-overhaul-phase37-homepage`, based on validated Phase 36 `f60d7ee` and committed integration baseline `803970d`. After the user's rebase completed, the audit and foundation commits were rebased in our separate worktree onto that integration baseline. The real cart provider, cart/checkout/payment handlers and operational changes are retained. The user's original worktree and its uncommitted proxy/abort-handling fixes are untouched and are not included in this branch's validation. Do not replace real cart actions/providers with older presentation code. Never force-push or move the user's working branches to deliver customer presentation.

## Palette

- Cream canvas `#F4EEE6`, supporting surface `#F8F3ED`, stronger surface `#EEE3D7`.
- Near-black text `#1E1A18`, secondary `#3A332E`, muted `#756A61`.
- Copper accent `#B86A2C`, darker actions `#9F5822`, hover/active `#864818`. Copper is an accent rather than a section-wide fill.
- Tan accents `#C6A07D` and `#E6D1BE`; quiet borders `#DEC7B0` and `#CBB092`.
- Essential control boundary `#98775E` supplies stronger contrast than decorative borders.
- Espresso `#241E1A` and `#312925`; light text `#F8F3ED`, subdued dark-section text `#DEC7B0`.
- Success `#3F6B52`, warning `#B77A2A`, danger `#A5463D`, information `#4E6778`. Warning text uses `#78501C` on its pale surface. Semantic states must not become brand copper.
- Focus `#8D4E1F` on light surfaces. Dark surfaces require light focus treatment with visible separation from the control.

Base copper fails ordinary small-text contrast against cream/white. Primary buttons therefore use the supplied darker copper; light button text has a 4.889:1 ratio. Muted text on cream is 4.565:1: do not lower its opacity or assume it works on darker tan surfaces. Quiet borders are decorative, not the only visible boundary for an input. `node scripts/check_storefront_tokens.mjs` checks the actual source palette and fails below the text/control thresholds; it does not establish whole-page accessibility acceptance.

## Typography

Editorial display uses locally available Georgia with serif fallbacks. Commerce/UI uses Segoe UI and system sans-serif. No remote fonts, font dependency, credential-bearing fetch or layout shift from downloading a font is introduced. Rendering varies slightly across platforms; licensed local fonts can be evaluated separately if later authorized.

The centralized roles are display (fluid 36–64px), heading (24–32px), subheading (18px), body (16px), small/control label (14px) and caption (12px), with display/body line-height tokens. Use `.sf-display` deliberately for merchandising headings. Product names and dense purchasing controls remain practical UI typography. Prices use exact decimal strings with explicit currency and tabular numerals. Avoid excessive bold weights and tiny metadata; later page phases adopt these roles systematically.

## Spacing, surfaces and motion

Spacing tokens follow 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 and 120px. Existing Tailwind spacing uses this scale; use tokens for reusable control/component contracts. Editorial sections may have generous spacing; product-heavy regions should remain denser.

Radii are 8px for small details, 10px for controls, 12px for product imagery and 20px for a deliberate large overlay. Use tonal separation and warm dividers before elevation. Small and overlay shadows are centralized; do not give every panel a floating shadow or pill shape.

Fast/normal transitions are 120/180ms with a shared easing curve. Loading skeleton timing is separate. Reduced-motion CSS disables storefront transitions, animations and smooth scrolling, including legacy animation utilities; it does not alter operational workspaces. Motion announces state/continuity, not decorative activity. Phase 43 may refine individual interactions.

## Shared component contracts

- `StorefrontButton`: native button; defaults to `type="button"`; primary/secondary/quiet/danger variants; busy state disables activation and communicates `aria-busy`. Forms explicitly choose submit. Links retain native navigation semantics.
- `StorefrontInput` / `StorefrontSelect`: associated label and unique identity, caller refs/handlers, preserved external descriptions, linked hint/error, native validation/keyboard behavior. Controls are at least 44px high and 16px text. Phase 36 search has a labeled native input/combobox, unique listbox/option identities, all-group keyboard selection, precise actual prices and explicit stale/failure/dismissal recovery.
- `StorefrontQuantity`: named native button group, live displayed quantity and integer bounds; unavailable/busy controls cannot change the value. Bounds are a UX hint, never inventory authorization. Django must accept each later mutation.
- `StorefrontBadge`: bounded, readable semantic status; supplied label remains visible. Use only real status evidence.
- `StorefrontPrice`: reuses `Money`/`formatMoney`, preserving every decimal digit and actual ISO currency. Previous price is semantic `del`. Discount percentages align decimal strings with BigInt; only the bounded integer percentage becomes a Number. Never convert price/total to binary floats.
- `StorefrontRating`: actual bounded rating/review count with readable text; stars are decorative. No fabricated stars or counts.
- `StorefrontSeller`: actual seller destination and name; long identities can wrap. It does not invent verification evidence.
- `StorefrontImage`: reserved square geometry, genuine source and useful alt text, contained merchandise, lazy loading by default, explicit unavailable-image fallback. The source/storage authorization is unchanged; no optimizer/public storage route is introduced.
- `StorefrontBreadcrumb` / `StorefrontSectionHeader`: semantic current page/list, wrap-safe navigation, restrained editorial section heading and genuine supporting actions.
- `StorefrontOverlay`: customer modal or right-side drawer styling around the existing native `Dialog`. Native top-layer behavior supplies background inertness; the customer wrapper loops Tab/Shift+Tab at the visible control boundaries and parks focus on the dialog when busy disables its controls. It reuses nested scroll locking, busy dismissal protection, error focus and focus restoration. Consumers own open state and accepted workflow results. Modal migration in existing filter/cart workflows belongs to later phases.
- `StorefrontNotice`: caller-provided inline/toast status, persistent until caller dismissal, errors announced urgently. No global event bus, optimistic financial success, fabricated confirmation or automatic error suppression.
- `StorefrontSkeleton` / `StorefrontEmptyState`: geometry only for loading; honest title/description/recovery for an empty response. Neither substitutes invented products for missing data. An error must not be represented as a successfully loaded empty state.

The new components live in `components/storefront`; semantic financial formatting and dialog behavior are reused rather than copied. Review all these contracts before building a customer-specific wrapper around an operational primitive.

## Product card rules

The card consumes the image, price, rating, seller and badge primitives. Keep genuine product/category/brand/seller destinations and backend availability. Prefer merchandise to chrome; thumbnails reserve geometry, unavailable imagery remains named, currency is explicit and long prices/identity can wrap. Do not invent campaigns, promotion eligibility or stock reservations. The Phase 35 card retains the existing content hierarchy; Phase 38/39 will refine composition, grid density and detail behavior.

## Responsive and accessibility rules

Retain bounded content at 80rem and existing route breakpoints until their phases. Check 375, 430, 768, 1024, 1440 and 1920px. Do not conceal overflow with a document-wide `overflow-x: hidden`; fix intrinsic sizing where it originates. A representative foundation review is not acceptance of every populated product, checkout or authenticated state.

Ordinary text requires 4.5:1 contrast; large text and essential control/focus boundaries require the appropriate 3:1 minimum. Supply a non-color selected/error/status cue, programmatic labels, useful alt text, visible focus and keyboard recovery. Native modal behavior must be verified in a real browser as well as tests; jsdom only mocks open/close. Never remove backend field errors, stale-request protection or authorization to simplify presentation.

## Customer shell rules

The shared compact wordmark uses local editorial type and one restrained outlined mark. Header actions use the existing local outline icon style and minimum 44px targets. Desktop navigation begins at 1100px; tablet retains a compact inline search and navigation trigger. Below 640px search occupies a full-width second row. Active locations have an underline as well as color; disclosure buttons/links retain native keyboard semantics rather than pretending to be application menus.

Mobile navigation is a native modal drawer with full-width search, actual category/seller/account/cart links, focus containment and restored focus/scroll. Autocomplete closes on the first Escape; navigation closes on the next. Desktop-resize dismissal focuses a visible destination. The header's skip link targets focusable customer main landmarks with sticky-header scroll clearance.

Announcement copy does not invent shipping/verification promises. Categories and the bounded latest-catalog seller preview distinguish loading, failure/retry and actual empty responses. Missing cart counts show an explained dash rather than a fabricated empty cart; loaded counts come directly from the real provider and visually cap at `99+`. Search cannot reopen after blur/Escape from a late response. All navigation stays on actual encoded relative destinations.

The espresso footer has three genuine destination groups, with its editorial introduction separated from navigation and compact shared branding below. On mobile two groups share a row and the seller group follows; at 640px three groups fit across. Unsupported policy/support/company/social routes are omitted until implemented. Do not restore fake home aliases or percentage/verified/shipping claims to fill a layout.

## Homepage composition

The homepage uses an editorial cream hero, local serif type, dark text and restrained copper emphasis. The strongest actions lead to genuine newest-product search and an existing seller section anchor. The right-hand spotlight is the first real newest product: use its actual public photo when present, otherwise a compact type-led panel with its category/title and explicit unavailable-photo text. Its seller and exact currency/price remain visible. Empty/error responses receive safe static brand content here, with the actual reason and recovery in the discovery sections below.

Featured categories immediately follow the hero; arrivals precede seller discovery, a short editorial seller invitation, three factual shopping-value statements and the completed espresso footer. Product/seller evidence drives every destination, price, availability and optional rating. No verified-seller, delivery, returns, popularity, promotion or social-proof claim is supplied without a matching contract. Product previews are at most eight records; seller previews are at most four distinct stores from the bounded newest page, not the whole marketplace.

Mobile hero spacing/actions and the unavailable-photo panel are compact enough to show the actual category entry at the first fold of the 900px-high 375/430px captures. Tablet/desktop hero columns remain balanced within 80rem. Dense product previews reserve consistent square image geometry, including missing images; one/two-product previews use a shorter consistent image area and horizontal desktop records to avoid a mostly vacant four-column grid. Long titles, categories, sellers and exact large prices wrap within their own region without concealing document overflow. Shared seller/PDP card design remains unchanged; discovery uses the Phase 38 composition below.

Independent loading, failure/retry and real-empty discovery states are mandatory. Decorative skeletons do not invent records. Retry clears old evidence; canceled responses cannot repopulate the homepage. `docs/storefront-homepage-review.md` records inspected screenshots, iteration and fixture/actual-data distinctions.

## Listing, category and search composition

Phase 38 uses a concise serif heading, actual result count, wrapped sort/filter toolbar and visible removable filters. Two merchandise columns fit mobile, three fit tablet and the 1,024px desktop rail, and four begin at 1,280px, inside the existing 80rem boundary. Product images stay square; category, readable name, optional brand, actual seller, exact current/previous price and optional actual rating lead the composition. Availability is real stock evidence, with no invented delivery, verification, popularity or extra badges/View buttons. Short catalogs keep the same predictable grid rather than implying a larger population.

Desktop filters form a plain 14rem rail with semantic groups, native checkboxes, selected borders/underlines and actual facets. Mobile uses the completed native drawer with explicit local drafts, Clear and Apply; only Apply changes the URL. The filter list scrolls separately from the always-visible actions. Closing discards drafts and restores focus; desktop resizing focuses the visible results heading. Labels, fields and actions retain readable sizes, named controls and keyboard recovery. Price fields use decimal strings and exact validation; quick range labels show listed-unit bounds, not unsupported currency conversion or inconsistent bracket counts.

The query, filters, sort and pagination are restored by browser history. New filters/sort reset to page one; Previous/Next use genuine local destinations and preserve applied state. Pagination appears when more than one page exists. Loading clears prior products/facets/count; errors have explicit retry rather than a false no-results message. Empty responses offer clear/reset, a real category suggestion and a labeled search alternative. An empty later page returns to page one with the same filters. Category routes retain category identity. Actual and separately labeled supplemental visual evidence is recorded in [storefront-discovery-review.md](storefront-discovery-review.md).

## Validation and remaining scope

Run repository `pnpm check` against PostgreSQL, quiet Compose configuration validation, the palette script, production route artifact audit and `git diff --check`. Representative screenshots and final counts are recorded in `docs/progress.md` and the individual phase reviews after validation.

Phase 34's proxy/cart failures, unsupported transaction success/shipping claims and assertion-only parsers outside homepage/discovery remain recorded debt. Existing cart total float arithmetic and premature product/cart success messaging also require later workflow corrections; the exact price primitive does not establish correctness of all older totals. Existing unpaginated category metadata, cross-currency search units and differing price-facet maximum semantics need a separately authorized backend contract change. No API/security/backend contract changes or new dependencies belong to these presentation phases. Stop after Phase 38; product-detail Phase 39 requires an explicit request.
