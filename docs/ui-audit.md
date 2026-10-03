# UI audit — Phase 23

## Scope and evidence

Audited the committed frontend at `97c240b` on 2026-10-03: 51 page routes; 135 source modules across app, components, features and lib; approximately 22,533 lines. Inspected the route inventory, layout and control markup across every feature family, shared primitives, auth/API/query boundaries, relevant tests, and representative complete workflows. This branch starts at the last published Phase 18 commit. Cart work in the main worktree is uncommitted; Phase 22 work is running separately and is not present in this baseline. Re-audit new routes after the security-first integration.

This is a source-based UI/UX audit. Browser discovery returned no connected browsers. No screenshots, rendered breakpoint measurements, keyboard browser sessions, screen-reader sessions or cross-browser checks have been performed. Responsive observations below are risks inferred from the actual CSS and markup, not fabricated visual results. Visual verification remains an explicit Phase 26/31/32/33 checkpoint.

Baseline checks: frontend lint, strict TypeScript and all **120 frontend tests across 15 files** pass. Production build is checked separately in progress. DOM integration tests establish behavior; they do not prove visual quality, browser-native focus trapping or contrast of every rendered element.

## 1. Design problems

- `components/ui/primitives.tsx` uses 30px page titles, while staff/reviews/promotions/notifications use 20px titles. Domain section headings vary between 16px, 18px and 20px without a hierarchy rule. Large secondary headings compete with entity identity.
- `features/workspaces/overview.tsx` presents eight equal bordered, shadowed KPI cards before meaningful operational priorities. Pending orders and low stock are subordinate to gross sales. Revenue badges duplicate their labels. Workspace/account metadata consumes a full panel at the bottom of each dashboard.
- Existing 80 `rounded-xl` occurrences across 37 files and 87 shadow utility occurrences across 34 files indicate a default card/overlay style used for unrelated information. Finance overviews, dashboard metrics, filters and detail sections need different visual treatment.
- Body uses Arial while no explicit numeric, title or label typography contract exists. Some labels use small uppercase tracking and others sentence case. Raw UUIDs and monetary values do not consistently receive appropriate secondary/right-aligned styling.
- Slate/teal dominate appropriately, but success uses both emerald and teal, warnings use several amber shades and domain badges duplicate status logic. Neutral-looking `StatusBadge` treats any unrecognized state as warning, including ordinary drafts and processing states.
- The current global blue focus outline is unrelated to the teal action color. Some domain controls use `focus:outline-none` and a border change instead of a coherent visible keyboard treatment.
- Content gutters, panel padding, border weight and radii are local choices rather than an explicit system. Nested DataTable borders inside bordered finance panels create double framing.

## 2. UX problems

- `workspace-frame.tsx` shows available destinations in one flat list. Orders, returns, catalog, staff, finance and account switching receive equal hierarchy. Nested routes lose their active indication because matching is exact only.
- Breadcrumbs stop at workspace mode and do not identify the actual collection/entity. Notifications exist at `/seller/notifications` but are not discoverable in the shell.
- Mobile Menu expands the entire navigation in document flow, pushing the workflow down rather than opening a dismissible drawer. It has no focus management comparable to the working native confirmation dialog.
- `ManagedForm` safely prevents repeated submissions, but lists server errors in one block and does not associate them with the individual controls. Domain forms implement separate saving/error patterns and several close controls remain available while sensitive requests are pending.
- Product detail is a long sequence of publication, general, variants, attributes, images and history sections. The publish action is separated from entity identity; a merchant has no deliberate editor section navigation.
- Catalog selectors use one search input plus a separate select and pagination. Keeping those bounded APIs is correct, but repeating this UI inside a long form makes the editor unnecessarily tall.
- Order detail prints shipping and billing objects with `JSON.stringify`. It exposes implementation-shaped records rather than human-readable address information already available in the response.
- Seller lifecycle and product confirmations often state a generic status change rather than the named target and specific consequence. Finance and inventory flows use local overlays instead of the shared confirmation/focus model.
- Reloading filtered lists often returns a whole-page loading state and removes the header/toolbar. Errors likewise replace the workflow instead of remaining near the affected region.
- Search/filter/page state is held locally in most administration views. Storefront search already demonstrates URL state; operational views cannot yet be reliably shared or restored by browser navigation.
- Destructive staff/role operations and finance transitions need a consistent consequence-aware confirmation pass. Preserve every existing server check and explicit action endpoint; do not invent bulk APIs.

## 3. Inconsistencies and route coverage

All existing page families are included. Dedicated return/payout/review detail URLs do not exist in this baseline; they are local detail overlays and are audited as such. There is no standalone analytics route; `/seller` and `/admin` own metrics. No platform users/roles/audit/settings routes should be invented merely to fill navigation.

- **Identity and entry:** `/login`, `/workspaces`, `/account`, `/onboarding`, `/forbidden`, global loading/error/404. Preserve session error recovery and logout error behavior; unify hierarchy, compact account metadata and action copy.
- **Seller dashboard:** `/seller`. Prioritize actionable counts, keep financial precision, place trends/performance below triage, and expose period labels. Current sales trend is a daily table, not a chart; use actual available series if a chart is introduced.
- **Catalog:** `/seller/products`, `/seller/products/new`, `/seller/products/[id]`; `/admin/products`, `/admin/products/[id]`, `/admin/categories`, `/admin/brands`, `/admin/attributes`. Preserve draft/review state machine, paginated relationship resolution and media validation. Improve section hierarchy, category/attribute configuration and moderation review composition.
- **Stock and organization:** `/seller/inventory`, `/seller/inventory/adjustments`, `/seller/warehouses`, `/admin/inventory`. Retain available/on-hand/reserved distinctions and attributable adjustment reason. Improve numeric columns and the stock adjustment overlay.
- **Orders:** `/seller/orders`, `/seller/orders/[id]`, `/admin/orders`, `/admin/orders/[id]`. Prioritize fulfillment/payment context, line items and actions; humanize addresses; align totals and use one readable chronology rather than status chips.
- **Fulfillment:** `/seller/shipments`, `/seller/returns`, `/seller/refunds`; `/admin/fulfillment`, `/admin/fulfillment/returns`, `/admin/fulfillment/refunds`. Improve filter consistency and embedded detail/action overlays; no new backend transition or carrier information.
- **Seller finance:** `/seller/finance`, `/seller/finance/transactions`, `/seller/finance/payouts`. Keep exact money and balance distinctions; remove double framing and move payout triage above supporting summaries.
- **Platform finance:** `/admin/finance`, `/admin/finance/commissions`, `/admin/finance/seller-balances`, `/admin/finance/payouts`. Preserve sensitive server-authoritative workflows; align amounts and consolidate plan/rule/payout overlays.
- **Growth and team:** `/seller/staff`, `/seller/staff/roles`, `/seller/promotions`, `/seller/reviews`, `/seller/notifications`; `/admin/promotions`, `/admin/reviews`. Custom tables, status badges, headers, pagination and overlays differ from shared primitives. Unify presentation while retaining capability limits and last-owner behavior.
- **Seller administration:** `/seller/settings`, `/admin/sellers`, `/admin/sellers/[id]`. Improve settings grouping; compose platform detail around identity, verification, documents and current available actions. Keep contact/evidence access separate and only show summaries available through authorized existing APIs.
- **Platform dashboard:** `/admin`. Prioritize pending seller/payout/moderation work; avoid repeating account identity in the main report. The current UI labels aggregated metrics USD; do not silently infer exchange rates or relabel mixed-currency financial data. Document uncertainty and preserve contract semantics until backend integration clarifies them.
- **Public storefront:** `/`, `/search`, `/categories/[id]`, `/products/[id]`, `/sellers/[id]`. These use a distinct merchandising shell and many inline SVGs. Shared token changes must not turn customer browsing into an administration UI. Preserve real product data, facets, variant selection and image behavior. Uncommitted `/cart` is outside this branch's baseline.

## 4. Accessibility concerns

- There are **28 hand-built fixed overlays in 18 feature files**, versus three uses of `ConfirmDialog`. The shared native dialog focuses cancel, handles Escape, restores focus and protects pending operations; keep it. Custom overlays vary in role/name semantics, focus containment, background inertness and Escape handling. Treat these as prioritized source findings, not a claim that native behavior has been browser-tested.
- Several review/shipment/permission forms have sibling `<label>` elements without `htmlFor` and matching control IDs. Use the proven `FormField` linkage or equivalent textarea/select primitives.
- Range buttons in dashboards show a selected style without `aria-pressed`. Filter/status cues need explicit text and accessible selected state, not color alone.
- Small 10px badges, tiny permission labels and low-contrast slate-400 timestamps/facet counts need a readable caption policy. Contrast must be measured for foreground/background pairs, including hover/focus states.
- A reused page-wide loading component nested in tables/dialogs produces oversized skeletons and unnecessary announcements. Provide local loading regions with stable layout and one relevant status announcement.
- Current data tables have useful caption/header semantics and keyboard-focusable overflow regions. Domain-local tables do not consistently provide scope, captions and numeric alignment. Preserve semantics when adding narrow-screen layouts.
- No dark theme is implemented (`color-scheme: light`). Do not claim dark-mode coverage or add a theme toggle before every surface supports it.

Accessibility references: [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). These guide the remediation; this audit is not an accessibility certification.

## 5. Responsive concerns

- **375px:** the 72px branded top bar, Account control and menu compete for width; the current navigation appears above content. A 335px content region loses another 48px inside a panel. Range controls can exceed available width. Review/order action rows and UUIDs need wrapping. Require local table scrolling or task-oriented stacked rows, never page-wide horizontal scroll.
- **430px:** preserve comfortable touch targets and expose one primary action. Validate product selectors and long status/reason text; the current panel plus nested form padding still reduces useful space substantially.
- **768px:** `md:w-60` sidebar begins here, leaving approximately 456px of main width before 72px gutters. It is too early for a full desktop shell alongside complex forms. Tablet should use a drawer until a persistent rail genuinely fits.
- **1024px:** `lg:grid-cols-4` dashboard cards and three-column order/finance layouts begin while the full sidebar still consumes 240px. KPI currency strings and long entity names can compete in roughly 160px columns. Design breakpoints around the available content width.
- **1440px+:** a 1600px shell with 240px sidebar can support dense two-region detail views. Current equal cards and long vertical editors still waste scan time. Cap form line lengths; allow genuinely wide tables to use the operational canvas.

Required later visual checks: dashboard, orders, product editor, seller review and payouts at all five widths; 200% text zoom, keyboard focus, narrow dialogs, long values, loading/error/empty states. Later Phase 31 adds 1280px/1920px. Record viewport, route, state and screenshot path; do not mark a screenshot checkpoint complete from tests or inferred CSS.

## 6. Existing architecture worth keeping

Keep feature-oriented routes, bounded Django contracts, explicit capability checks, independent seller context, auth/query cancellation and runtime response parsing. Keep exact BigInt money display and explicit timezone dates. Native inputs/selects and `ConfirmDialog` provide a simpler accessible baseline than a new form/dialog framework. DataTable's explicit columns, caption and region are a good extension point. Use existing semantic buttons and no new chart/table/form dependencies unless an implemented use case demands one.

## 7. Components requiring redesign

First: presentation tokens, shared headers, button/control styles, labeled form controls, native modal foundation and page/content layouts. Next: grouped WorkspaceFrame with nested active matching, responsive drawer and contextual breadcrumbs. Then: dashboard composition, DataTable numeric/mobile behavior, URL-filter toolbars and domain forms/overlays. Finally: professional product/order/seller/return/payout detail composition and shared timelines. Do not migrate all pages via unreviewed global selector overrides.

## 8. Design principles

One prominent primary action per workflow; operational exceptions before summaries; readable 14px data; 26px page titles; 44px touch controls with denser desktop rows; no shadow on normal sections; cards only for bounded summaries or elevated interactions. Tables and open sections carry most of the information. Use restrained green for selection/actions and semantic hues only for meaningful state. Concise entity-specific language. Retain empty/loading/error reality without fake metrics.

## 9. Visual language

Implement the concrete values and policies in `design-system.md`. Phase 23 adds only the token boundary and global font/focus integration. Existing screen structure remains intact until its assigned phase. The baseline is a light, neutral operational canvas, dark charcoal text, modest green accents, small corner radii, aligned data and quiet dividers. No external font request, gradient, decorative graphic or new UI library is required.

## 10. Prioritized implementation plan

1. **23:** audit and concrete design contract; shared tokens; preserve baseline behavior.
2. **24:** accessible primitives/layouts and consistent interaction states; migrate shared components first. Resolve reusable overlay gaps before reproducing them in new screens.
3. **25:** role/capability-specific grouped navigation, contextual breadcrumbs and tablet/mobile drawer.
4. **26:** real-data triage dashboards; after validation capture 1440px and mobile Seller Dashboard screenshots and critique the rendered result when available.
5. **27:** aligned, readable tables; consistent bounded URL filters; intentional narrow-screen views; no invented bulk endpoints.
6. **28:** grouped forms, inline server errors and consequence-aware workflows; coherent product editor; sensible unsaved-change protection.
7. **29:** compose entity detail and audit/history; human-readable addresses and operational actions.
8. **30:** restrained state feedback and reduced-motion-safe transitions; localized skeletons; sensitive operations stay server-authoritative.
9. **31:** dedicated responsive/keyboard/contrast pass with explicit evidence and remediation.
10. **32:** visually inspect each major workflow for repetitive framing, badge noise, oversized text and generic component-library feel. Remove clutter instead of adding decoration.
11. **33:** final route/state/performance review and `ui-final-review.md`; record actual visual evidence and remaining limitations.

Every phase must pass frontend lint, TypeScript, the unweakened frontend suite, formatting and production build before commit/push/advancement. Security/backend work merges first; UI rebase happens only after both branches are clean and tested. Follow `UI_CURRENT_PHASE.md` without altering the concurrent backend selector.

## Phase 27 operational table review

Every shared table consumer was reviewed by feature family. All retain bounded backend pagination where that contract exists; no bulk/sort operation was fabricated.

- Catalog categories, brands and attributes: retain semantic columns and per-row capability actions; share the stacked mobile layout. Category sort order and variant prices align numerically. Product/moderation lists have bounded debounced search, allowlisted statuses, shareable URL state and clear active filters.
- Seller/platform order lists: human order number remains the primary link, the parent number is secondary and copyable, amounts/counts align right, all financial fields remain present on mobile. Existing payment/fulfillment/seller-order statuses are independently allowlisted. Important search/status/page state restores from URL/history.
- Platform seller management: keeps explicit Apply, exposes readable active filters, preserves route context during pagination, restores form values on Back/Forward and never derives authority from URL state.
- Live inventory: product identity precedes the secondary copyable SKU. Reorder, on-hand, reserved and available quantities align right. Search/low-stock/page preferences are shareable; controls remain mounted during loading or failed queries.
- Inventory transaction and financial ledgers: retain every audit/reference/financial field and use local horizontal scrolling on narrow screens. Inventory timestamps now use the explicit UTC display helper, transaction labels use the shared neutral status presentation and ledger type/page filters are URL-backed. Removed the nested frame around the financial ledger.
- Seller/admin payouts and seller balances: keep amounts and balances exact/right aligned; stacked mobile rows retain financial data and real actions. Payout status/page preferences are URL-backed. Payout navigation now checks the separate `payouts.read` capability instead of assuming `finance.read` grants it.
- Fulfillment shipment/return/refund and platform oversight tables: use stacked mobile rows with the same semantic status labels; amounts/counts align right and mutations remain guarded by their existing capabilities.
- Dashboard top-products/top-sellers/category tables and workspace memberships: use the same stacked rows and explicit numeric alignment. Chart data remains separate from the table contract.
- Raw tables in promotion/staff/commission editors and order details retain native semantics and local overflow. Their form/action or entity-detail composition belongs to Phases 28/29; those workflow migrations must preserve authoritative API calls and immutable financial/history displays.

No screenshots or real narrow-width table rendering are claimed. The single-markup mobile layout, history behavior and complete financial data are covered by automated behavior checks; actual visual, Safari table semantics and assistive-technology review remain pending.
