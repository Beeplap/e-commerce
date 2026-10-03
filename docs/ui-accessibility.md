# UI accessibility and responsive evidence

## Phase 31 implementation

Eight legacy controls lacked explicit accessible labels: balance search, return condition, tracking status, promotion discount type in both workspaces, review response, inline staff role and invite role. They now use associated shared fields or a member-specific accessible name. A TypeScript JSX source audit covered 50 remaining raw administration controls and found zero missing explicit associations. This audit does not validate rendered accessible names by itself.

Fulfillment uses semantic tablist/tab/tabpanel relationships with unique instance IDs, one tab stop, wrapping Left/Right and Home/End navigation, selected state and focusable evidence panels. Content requests remain the existing preloaded authorized reads; inactive content is unmounted. This follows the [W3C APG tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). Chart evidence has a native disclosure and full semantic table of actual recorded dates, exact sales/net amounts and orders, with keyboard scrolling and no estimated missing days.

Warehouse create/edit now uses the native dialog foundation instead of an inline div claiming to be a dialog. Cancel/Escape restore trigger focus; failed values persist and errors receive focus. Existing business payloads and capability rules remain. Account disclosure closes when keyboard focus leaves without pulling focus back. Ratings have a named image role and readable warning color; review filters announce selected state.

Workspace text controls use 16px text and 44px minimum height, including legacy controls. Disabled controls retain readable neutral colors without opacity reduction. Coarse-pointer buttons, summaries, checkbox/radio labels and table links have reasonable touch areas. Review, notification and role actions stack on narrow screens; capability names may wrap. Focus and product anchors reserve room for the sticky header. Complex ledgers/configuration retain local scrolling and complete evidence.

## Automated evidence

- Six new behavior tests cover tab traversal/relationships/instance identity, exact complete chart alternatives, named staff controls, warehouse failed-input/error/focus behavior and account focus departure.
- Token calculations cover 23 text/focus/control pairings. Normal text meets 4.5:1 and relevant non-text edges/focus meet 3:1. Disabled text on its muted surface is 4.90:1; the quietest body text on a muted surface is 4.50:1. These are token calculations, not computed-style results.
- Existing authentication, capability, tenant context, unsafe request, failed action and exact-money regression assertions remain intact. No accessibility engine dependency was added; ESLint and Testing Library provide limited automated semantic checks.

## Live evidence remains unavailable

Browser discovery repeatedly returned `[]`; no screenshots, rendered-width inspection, browser-native tab containment, screen-reader output, zoom, reduced-motion rendering or cross-browser checks were performed. After being told about this requirement and offered holding or continued implementation with recorded gaps, the user replied “continue” on 2026-10-03. Work therefore continues with source/automated evidence; visual acceptance is outstanding.

The required viewport cases all remain **unverified**:

- 375px: navigation drawer, top-bar clipping, stacked records, primary actions, dialog fields and touch controls.
- 430px: the same workflows with long names, errors and full identifiers.
- 768px: table/stacked transition, forms, wrapped filters and secondary content.
- 1024px: desktop navigation transition and drawer cleanup with live focus.
- 1280px: detail/dashboard main-secondary hierarchy and configuration density.
- 1440px: complete seller/platform dashboard critique and all major route families.
- 1920px: maximum content width, data alignment and readable chart/form proportions.

Run these against authenticated authorized states, read-only and denied states, loading/error/empty views and pending/rejected actions. Check keyboard-only operation, screen-reader labels/order, 200% zoom and reduced motion in Chromium, Firefox and Safari-compatible rendering. Record route, viewport, state, browser and screenshot path. Screenshots alone cannot establish keyboard/screen-reader behavior. Do not treat this checklist as completed visual QA.
