# Operational design system

## Direction and scope

Phase 23 defines the contract; Phase 24 implements primitives; later phases migrate workflows. Presentation lives in `apps/web/styles/tokens.css`, shared components in `components/ui`, and domain composition in `features`. Preserve the feature/API/auth boundaries. Do not invent data, backend features, hidden authority, or screen-level token variants to evade this system.

Design for long merchant/platform work sessions: compact hierarchy, aligned data, calm neutrals, visible keyboard focus and specific actions. Public storefront layouts may retain merchandising density while sharing colors, controls and accessibility.

## Typography

Use the local system sans stack (`-apple-system`, BlinkMacSystemFont, Segoe UI, Arial, Helvetica, sans-serif); no external font service or new request. Use monospace only for short SKU/reference excerpts. Use tabular numerals for counts and amounts; money remains an exact decimal string.

- Page identity: 26px / 32px, weight 600, slightly tight tracking; 24px / 30px on narrow screens. No admin hero typography.
- Section title: 18px / 24px, weight 600. A single section heading should introduce related work, not repeat the page title.
- Small group/panel title: 14px / 20px, weight 600.
- Body and table: 14px / 22px; table line height may be 20px. Main body weight 400, entity/action emphasis 500–600.
- Secondary text: 13px / 20px. Captions: 12px / 18px; no 10px operational labels.
- Field label: 13px / 20px, weight 500, sentence case. Required state is visibly identified as well as semantically required.
- Primary KPI: 28px / 34px, weight 600; supporting metrics 20px / 28px. Equal-sized giant numbers do not define information importance.
- Input text: 16px on touch/narrow layouts, 14px where appropriate on desktop. Do not shrink mobile text merely to fit a form.

`text-ui-page`, `text-ui-section`, `text-ui-body` and `text-ui-caption` are semantic Tailwind token aliases. Domain headings migrate deliberately; no global `h1`/`h2` reset that overrides storefront composition.

## Spacing and size policy

Use a 4px base with 4, 8, 12, 16, 20, 24, 32 and 40px steps. Related label/control gap 6–8px; field/helper gap 6px; fields 16–20px apart; section content 16px; unrelated sections 24–32px. Avoid 48px panel padding around dense operational content.

Normal controls 40px high on desktop, minimum 44px hit areas on touch/narrow views. Compact contextual controls may be 32px only with adequate separation; row/icon action buttons retain an accessible target. Default data row approximately 48px; rows with secondary identifiers 56px. Compact 40px rows are appropriate only for dense desktop ledgers. Headers 40px.

## Radius, elevation and borders

Control radius 6px; panel/table container 8px; dialog/popover 10px. Full rounding is reserved for avatars or small dot indicators, not every badge/control. Status labels use 4px or 6px radius. No large rounded rectangles enclosing every section.

Normal page sections, filters, tables and metrics have no shadow. One light shadow is allowed for anchored menus/popovers; modal separation uses a subdued backdrop and one overlay shadow. No gradients, glass effects, blobs or decorative elevation.

Use 1px neutral dividers where they clarify groups/rows. Avoid border-plus-shadow on normal content and remove double framed tables. Input borders use the stronger control-border token; passive panel borders use the quieter structural token. Not every section needs a containing border.

## Colors and surfaces

Single light theme initially. The baseline has no dark mode. Add dark mode only as a separate intentional contract with complete foreground/surface/interactive coverage, never a cosmetic toggle over light-only feature code.

- Canvas `#f7f8fa`; primary surface `#ffffff`; muted/hover surface `#f0f2f4`.
- Primary text `#20252b`; secondary `#56606d`; muted/caption `#64707d`.
- Structural border `#dce1e6`; control boundary `#89939f`.
- Action/selection accent `#176b57`; hover `#125744`; selected surface `#e8f3ee`; focus `#177a68`.
- Success text `#176346` on `#edf7f0`; warning `#855400` on `#fff5df`; danger `#a63535` on `#fff0ef`; information `#285d89` on `#edf4fa`.
- Disabled text `#606a76` on the muted surface. Do not lower the opacity of an entire control indiscriminately; disabled text still needs to be readable.

Semantic color always accompanies words or a meaningful icon. Draft/archived/inactive are neutral; pending/review/hold are warning where operational attention is relevant; approved/delivered/paid/verified are success; rejected/suspended/failed are danger; processing/shipped can be information. Explicitly map known statuses; unknown states remain readable and neutral rather than silently signaling risk.

Require at least 4.5:1 for normal text/placeholder pairings and 3:1 for meaningful control/focus boundaries; measure actual states. The subdued structural divider need not pretend to identify a control. Reference: [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). This is a design target, not a claim that every existing screen already complies.

## Content grid and shell

Shell maximum 1440px; persistent sidebar 240px; restrained top bar 56px. Main gutters 16px at 375/430px, 24px at tablet, 32px at wide desktop. Persistent sidebar starts at 1024px; use a native modal drawer below that threshold. Do not allow the navigation to push the workflow down the page. Sidebar sections use quiet labels and compact links; only available features appear.

Operational tables use available content width. Form content is generally capped at 768px; short settings/auth forms 440–560px. Entity detail can use a main column plus 288–320px metadata/action aside when content width supports it, stacking with deliberate order below that point. Grid children require `min-width: 0`; long identifiers wrap or truncate with an accessible full value. Page actions wrap predictably and primary actions remain visible.

Breadcrumbs identify actual section/entity context, not merely workspace mode. Parent destinations stay active on detail routes. Workspace switching/account actions are separate from commerce navigation.

## Tables and filtering

Prefer a primary entity column with secondary identifier; right-align amounts/counts; use consistent column spacing (16px), header text (12px/18px, weight 600) and 48px normal rows. A readable hover highlights a row without implying that every cell is clickable. Selection only exists for backend-supported workflows. Keep semantic table/caption/header markup and keyboard overflow regions.

Primary search plus useful existing filters share one toolbar. Filter summaries and Clear filters appear only when active; URL state restores search/status/page where appropriate. Debounce text search while preserving request cancellation. Do not invent ordering/filter parameters not supported by the API. Explicit empty/no-matching/loading/error states retain relevant controls and never hide a failed request as success.

On mobile, choose stacked entity rows for manageable tables and local horizontal scrolling for genuine ledgers/comparisons. Do not hide material financial information to make a table fit. No page-wide scrolling or sticky columns by default. Pagination is bounded and preserves actual backend page size.

## Forms and workflows

Group related inputs with headings and short descriptions only where they affect a decision. Labels remain visible; show required state; descriptions and server errors are associated with controls. A submit failure preserves the user's input and gives a useful form-level summary plus relevant inline errors. Success is scoped to the completed form. No unnecessary toast library or schema/form dependency.

Use a reusable labeled textarea/select for non-input fields and native controls first. Only add a combobox when the complete keyboard/focus/value contract is implemented. A complex product editor uses actual existing sections and clear section navigation; no invented SEO/inventory fields. Sticky save controls are useful only when they respect viewport/focus and identify which form they save.

Consequential actions name the target, action and consequence. Cancel is initially focused for destructive confirmation. Pending sensitive operations prevent repeat submission and misleading dismissal. Reuse native dialog behavior for focus containment/background inertness/Escape/focus return. References: [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Dirty-state warning is appropriate for long editors/onboarding, not every search or short form. Any navigation interception must work with keyboard/back navigation without violating Next.js routing behavior. Financial/security actions receive no optimistic success.

## Icons and motion

No dependency is required for the initial foundation. If icons are needed, use one shared set of local, consistent outline SVGs: 16px inline/row, 18px navigation, 20px primary control, 1.75px stroke, `currentColor`. Do not mix emoji, variable-size inline glyphs and unrelated icon families. Hide decorative icons from assistive technology; icon-only actions need a name and tooltip when useful.

Motion is functional and brief: 120ms hover/feedback, 180ms overlay continuity, ease-out curve `cubic-bezier(0.2,0,0,1)`. Animate opacity/color rather than dramatic scale or page movement. `prefers-reduced-motion` sets token durations to zero; each animation outside tokens must be reviewed explicitly. Keep `motion-safe` skeleton animation. No chart gradients or nonessential animation. Loading skeletons match the region being replaced; avoid whole-page spinners for a table mutation.

## Component architecture and validation

Extend the existing shared primitives compatibly. Put presentation layout helpers (PageShell/PageActions/ContentSection/SplitLayout/DetailGrid/StatGroup/Toolbar) in `components/ui` only as real screens use them. Do not replace the API client, query hook, auth provider or permission helpers as part of visual consolidation. Domain-specific state/action logic stays in features. Native semantic HTML is the baseline; abstractions must retain labels, focus, roles and failure behavior.

Phase 23 tokens intentionally do not rewrite feature utility classes. Phase 24 begins consumption in shared primitives; workflow phases replace local variants with meaningful tests. Existing functional/security tests remain intact. Each UI phase requires lint, strict TypeScript, all frontend tests, production build and formatting before push/advancement. Review real screenshots and keyboard interactions at prescribed checkpoints when available. Record browser/tool limitations honestly; unit tests are not visual QA.

Integration order: clean/test security/backend branch, merge it first, then rebase/test `ui-overhaul`, resolving only real frontend conflicts and preserving secure contracts. This roadmap's selector is `UI_CURRENT_PHASE.md`; concurrent backend scope remains in `CURRENT_PHASE.md`.
