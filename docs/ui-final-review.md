# Final UI review

UI phases 23-33 implementation and local frontend validation are complete on `ui-overhaul`, based on the Phase 18 checkout at `97c240b`. This is not visual acceptance or a production release. Browser discovery returned `[]` again during Phase 33. The user directed continuation after being informed of the missing live evidence. Screenshots, seven-width review, native keyboard/screen-reader behavior and cross-browser rendering remain unverified. Security/backend integration is also outstanding.

## 1. Design system

`styles/tokens.css` defines a neutral canvas, white surfaces, quiet separators, restrained green accent and semantic state colors. System fonts avoid font downloads. Normal workspace text is 14px, captions 12px, controls 16px, section titles 18px and page titles 26px on larger screens. Controls/panels/overlays use 6/8/10px radii. Financial values keep exact decimal strings and tabular numerals.

Task hierarchy drives composition. Current operational work precedes performance; current funds precede lifetime totals. Tables frame data, while record lists and related configuration use separators. Scope labels, verified-purchase text and permissions are quieter than actionable state. Concise descriptions and specific commands replace formal copy. See `design-system.md` and the Phase 32 decisions in `ui-audit.md`.

## 2. Component architecture

App Router pages remain small feature entry points: 46 of 51 source pages are Server Components; five existing public storefront pages explicitly use client rendering. Interactive features consume the shared `components/ui` foundation for buttons/fields, tables/pagination, errors/loading, dialogs/drawers, tabs, definition lists, identifiers and timelines. Domain workflows remain in feature modules. The account feature now has its own module, so its page does not import dashboard/chart implementations.

Phase 33 consolidates three duplicated status implementations, both review-rating implementations and six copied pagination footers. Unknown statuses remain neutral. Published/removed review state retains its previous semantic meaning. Platform promotion state now has visible Active/Inactive text instead of a color-only dot. Metric hints belong inside their definition-list description. Seller review response dates use the explicit UTC/date helper.

Django remains the authentication, authorization and tenant authority. Client guards only govern UX. No confidential Server Component/RSC load was introduced. Browser calls still use the same-origin validated API client, cookies, fresh CSRF on unsafe operations and explicit seller context; credentials and authority are not stored in browser storage. Financial/security workflows wait for the backend response. Backend endpoints, models, migrations, payloads and policies are unchanged by this UI roadmap.

## 3. Navigation system

Seller/platform sidebars group the actual available routes and respect explicit capabilities. Parent sections remain active on detail pages; breadcrumbs identify route context without making UUIDs primary headings. Account actions and seller switching remain separate from operational navigation. The mobile native drawer dismisses on navigation, Escape and desktop transition. Seller selection revalidates against Django.

The route audit found that `/admin/fulfillment/returns` and `/admin/fulfillment/refunds` initially selected Shipments. They now select their named view. Destination/user identity keys reset the fulfillment workspace; switching tabs still uses the existing authorized reads and refund capability. A regression verifies direct-view selection, destination changes and read-only command visibility.

## 4. Responsive strategy

The shell caps content at 1440px with a 240px sidebar and 56px top bar. Gutters are 16/24/32px. Desktop navigation begins at 1024px. Forms generally cap at 768px, and entity secondary content stacks below the wide layout. Grid/flex children allow shrinking and long identifiers wrap or remain available to copy.

Ordinary tables use one semantic record markup with stacked fields below 768px. Financial/audit ledgers and specialized editable configuration retain named local horizontal scroll regions and complete evidence. Actions/filters wrap instead of removing material values. Dialog height uses a `vh` fallback before `dvh`. Live review at **375, 430, 768, 1024, 1280, 1440 and 1920px remains unverified**. See `ui-accessibility.md` for the precise cases.

## 5. Accessibility and browser assumptions

Shared controls have associated labels, descriptions and server errors. Important forms preserve failed values and focus the invalid field or summary. Native dialogs provide application-controlled opening/dismissal/focus return, busy protection and nested scroll cleanup. Tabs have named relationships, roving focus and arrow/Home/End traversal. Charts expose exact full recorded data through a native disclosure and semantic table. Ratings have an accessible name; unread and promotion states are visible in text. Reduced-motion styles disable decorative motion.

Phase 31 calculated 23 token contrast pairs and audited 50 remaining raw administrative controls with zero missing explicit source associations. ESLint and component regressions pass. These do not establish computed contrast, native focus containment, touch comfort, screen-reader output or rendered table semantics.

The installed Next.js browser guide includes Firefox 111, but the combined CSS/runtime floor must respect Tailwind 4's **Chrome 111+, Firefox 128+, Safari 16.4+** requirements. This is a compatibility assumption, not a tested browser matrix. [Tailwind official compatibility](https://tailwindcss.com/docs/compatibility). Native dialog, details, grid/flex, range media queries, dynamic viewport units and the coarse-pointer `:has()` enhancement fit that target; no experimental CSS feature was introduced. The optional Navigation API is feature-detected. Older browsers retain link/context/exit warnings but cannot reliably cancel SPA Back/Forward. Browser-specific focus, mobile viewport and assistive-technology behavior still require live testing.

## 6. Interaction philosophy

Loading/error/empty/pending states describe actual outcomes. Skeletons contain no fake counts or records. Replacement query loading preserves measured geometry only, never prior tenant data. Stale queries are aborted/discarded; related order reads are bounded, permission-specific and loaded on demand. URL filters are allowlisted and bounded, and deliberate view preferences restore through history.

Save feedback follows acknowledged success. Dirty important forms warn before supported departures without persisting draft data. Consequential commands identify the target and effect, initially focus Cancel and prevent duplicate submission. Clipboard feedback waits for successful writing and ignores an old visible record. Financial/security actions receive no optimistic success. Short opening/color/save feedback respects reduced motion.

## 7. Route and screen review

All **51 source page routes** match existing production manifest entries. This is source/composition and artifact evidence, not screenshot coverage. All major administrative families were reviewed for hierarchy, spacing, long evidence, state handling and shared patterns. Existing tests exercise successful, denied, stale, pending and failed workflows; no claim is made that every route/state combination was tested live.

- Identity and entry: `/login`, `/account`, `/workspaces`, `/onboarding`, `/forbidden`. Shared authentication/field/error behavior, grouped registration and restrained membership selection remain.
- Seller overview/catalog: `/seller`, `/seller/products`, `/seller/products/new`, `/seller/products/[id]`. Operational priority, honest reporting ranges, exact trends, URL list filters, grouped editing and actual review history.
- Seller inventory/orders: `/seller/warehouses`, `/seller/inventory`, `/seller/inventory/adjustments`, `/seller/orders`, `/seller/orders/[id]`. Named stock controls, complete ledger evidence, precise immutable totals and contextual actions.
- Seller fulfillment/finance: `/seller/shipments`, `/seller/returns`, `/seller/refunds`, `/seller/finance`, `/seller/finance/transactions`, `/seller/finance/payouts`. Native inspection/command dialogs, supplied histories, grouped funds and independent payout capability.
- Seller growth/organization: `/seller/promotions`, `/seller/reviews`, `/seller/staff`, `/seller/staff/roles`, `/seller/settings`, `/seller/notifications`. Responsive promotion evidence, separated records, meaningful status/rating text, editable staff configuration and actual unread state.
- Platform overview/catalog/sellers: `/admin`, `/admin/categories`, `/admin/brands`, `/admin/attributes`, `/admin/products`, `/admin/products/[id]`, `/admin/sellers`, `/admin/sellers/[id]`. Explicit platform capabilities, operational approval work, bounded management tables and private evidence inspection.
- Platform operations: `/admin/inventory`, `/admin/orders`, `/admin/orders/[id]`, `/admin/fulfillment`, `/admin/fulfillment/returns`, `/admin/fulfillment/refunds`. Full material evidence, exact totals, related work, semantic tabs and corrected direct destinations.
- Platform finance/growth: `/admin/finance`, `/admin/finance/commissions`, `/admin/finance/payouts`, `/admin/finance/seller-balances`, `/admin/promotions`, `/admin/reviews`. Payout work precedes quieter totals; rule editors scroll locally, consequential mutations confirm and promotion state is readable without color.
- Existing public storefront: `/`, `/search`, `/categories/[id]`, `/products/[id]`, `/sellers/[id]`. Preserved outside the seller/platform redesign; build/regression coverage passes. Known baseline issues below require separate follow-up.

`/health` and built-in error/not-found handling remain. The build generates 45 static artifacts, including 43 source-page artifacts; eight source detail routes are dynamic. Sampled protected static HTML shows the loading shell, not account/tenant data. That sample does not prove dynamic authorization or replace Django's backend tests. Dark mode is not supported; `color-scheme: light` is deliberate.

## 8. Performance considerations

Reproduce artifact analysis after `pnpm build` with `node scripts/audit_ui_build.mjs`; `--json` includes all route records. The tool fails on a missing production build or missing source-page entry. It reads artifacts without starting services or accessing secrets.

Node 24.15.0 final-build measurements:

- All 65 emitted JavaScript files: **1,793,505 raw bytes / 536,600 estimated gzip bytes**. This is the whole build, not one page's transfer.
- One shared CSS file: **54,969 raw bytes / 11,078 estimated gzip bytes** (10.8 KiB).
- Largest static route, `/admin/finance/payouts`: **561,260 raw JavaScript bytes / 167,675 estimated gzip bytes** (163.7 KiB), 12 scripts.
- `/seller`: **163,735 estimated gzip JavaScript bytes**; `/admin`: **164,004**; `/login`: **150,824**.
- Splitting the account feature reduced `/account` from **162,997 to 156,416 estimated gzip JavaScript bytes**, about **6.4 KiB / 4%**, while preserving its authenticated data and route.

The method deduplicates static HTML script/stylesheet references per route, excludes `nomodule` scripts and sums separate level-9 gzip asset sizes. It does **not** measure RSC/HTML transfer, dynamic routes, prefetching, cache behavior, network requests, JavaScript parse/runtime cost, Core Web Vitals or hydration in a real browser. No Lighthouse score or performance budget pass is claimed.

The chart uses native SVG and exact-decimal geometry rather than a chart package. Icons use the local outline family; no broad icon dependency, remote font or new image asset was added. Query loaders are stable callbacks, search is debounced, observers/listeners clean up, and chart inspection state stays local. Large financial workflow modules remain candidates for profile-led splitting, not speculative abstractions. Protected interactive reads stay client-side until an explicitly reviewed Django-authorized server-load contract exists. Public image optimization/URL policy belongs to storefront integration.

## 9. Validation and known limitations

Final frontend lint (zero warnings), strict TypeScript, **187 tests across 25 files**, production build, repository formatting, build-artifact audit and `git diff --check` pass. Phase 33 adds promotion state/pagination and direct fulfillment destination regressions. Existing assertions remain. One full run observed warehouse error markup before its passive focus effect; the same focus assertion now waits for the effect. Account extraction initially removed a helper still used by dashboards; lint/TypeScript caught it, the helper was restored and the complete gate rerun.

Outstanding evidence/work:

- No screenshots or live viewport/keyboard/screen-reader/zoom/reduced-motion/cross-browser/hydration/performance validation. The Phase 26 Seller Dashboard critique at 1440px and mobile remains pending. Do not label source inspection as visual acceptance.
- Phase 22 work in the other worktree is uncommitted. Last fetched remote main is `5d5195a`, publishing Phase 20. No backend merge, UI rebase, PostgreSQL `pnpm check`, Compose integration or actual proxy smoke was run for this isolated UI completion. Those are the integration gate after backend work is clean/tested and merged first.
- Existing platform financial aggregates lack reporting-currency/conversion metadata; the baseline USD convention is retained without a correctness guarantee. Analytics category payload/type mismatch and missing historical return currency remain documented; no guessed values were introduced.
- Existing platform fulfillment previews have no complete paging UI, although backend list reads are bounded. Address this as an explicit functional follow-up rather than adding a major Phase 33 feature.
- Preserved public storefront code still uses floating-point/hardcoded-dollar money display, suppresses some browse/search failures, and has locale/year rendering and raw-image follow-up needs. These violate the intended precision/error consistency and require correction in the concurrent storefront/backend scope; they were neither introduced nor silently treated as passing security work here.

## 10. Future UI opportunities

Obtain actual authorized-state screenshots and complete the recorded manual matrix before visual release approval. Begin with the Seller Dashboard at 1440px/mobile and critique the rendered result before changing its layout. After backend integration, rerun the full PostgreSQL/Compose/proxy/frontend gate and review genuine frontend conflicts, including customer routes added after the UI baseline. Profile actual devices before further bundle/re-render work. Review storefront precision/errors/images and missing reporting contracts under explicit scope. Dark mode, additional bulk/sort actions and large component libraries require a demonstrated product need.

Phase 33 is the last authorized UI phase. The implementation selector is complete; no next phase is invented or started.
