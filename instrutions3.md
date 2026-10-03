# UI/UX OVERHAUL — EXECUTION RULES

You are working on an existing production-grade multi-vendor e-commerce platform.

The backend architecture, API contracts, security model, RBAC, tenant isolation, and business logic already exist.

Your task is to elevate the frontend from a functional administration interface into a polished, premium, modern product that looks intentionally designed by an experienced human product team.

DO NOT redesign backend architecture.

DO NOT change API behavior unless a frontend defect genuinely requires it.

DO NOT weaken:

- authentication
- authorization
- CSRF
- tenant isolation
- validation
- tests
- accessibility

Before touching code:

1. Read `AGENTS.md`.
2. Read relevant documentation.
3. Inspect the entire existing frontend.
4. Understand current routes, components, design primitives, forms, tables, charts, and layouts.
5. Preserve working functionality.
6. Reuse good existing architecture rather than replacing things gratuitously.

The visual goal is:

- premium SaaS
- sophisticated marketplace operations software
- calm
- information-dense without feeling crowded
- modern but not trendy for the sake of trendiness
- highly usable
- human-designed
- consistent
- polished in light and dark environments if dark mode already exists or is added intentionally

Avoid stereotypical AI-generated UI.

Specifically avoid:

- excessive gradients
- purple/blue gradients everywhere
- giant rounded cards everywhere
- excessive pill-shaped controls
- every section being inside a card
- excessive drop shadows
- excessive glassmorphism
- arbitrary decorative blobs
- huge whitespace that reduces information density
- giant hero text in admin interfaces
- random icon usage
- unnecessary animation
- fake metrics
- decorative charts without operational value
- overusing borders
- inconsistent spacing
- generic "template" feeling

Prefer:

- strong hierarchy
- excellent typography
- restrained color
- intentional whitespace
- subtle elevation
- strong table design
- good empty states
- excellent filtering
- command-oriented workflows
- keyboard usability
- predictable interaction patterns
- clear state/status representation
- dense but readable business interfaces
- carefully designed detail pages
- responsive behavior
- accessibility

Use the existing design/component stack unless there is a strong reason to extend it.

Every UI phase must end by running:

- frontend lint
- TypeScript checks
- frontend tests
- production build

Do not make tests pass by weakening them.

---

# UI PHASE 23 — Complete product design audit and visual direction

DO NOT redesign everything immediately.

First perform a comprehensive UI/UX audit.

Inspect all existing pages including:

- authentication
- seller dashboard
- seller products
- product detail/edit
- inventory
- warehouses
- orders
- order detail
- seller finance
- seller payouts
- staff
- reviews
- promotions
- settings
- Super Admin dashboard
- sellers
- seller detail
- admin catalog
- admin order management
- admin finance
- moderation
- analytics

Evaluate:

### Visual consistency

- typography
- font sizes
- line heights
- weights
- spacing
- radii
- shadows
- borders
- colors
- icon sizing
- alignment
- density

### UX consistency

- page headers
- filters
- tables
- pagination
- dialogs
- destructive actions
- save patterns
- forms
- toast/feedback patterns
- navigation
- empty states
- loading states
- errors

### Information hierarchy

Find screens that:

- overuse cards
- bury important actions
- show irrelevant information
- have poor grouping
- contain excessive whitespace
- are visually noisy
- have weak scanability

### Mobile/tablet

Audit responsive behavior at:

375px
430px
768px
1024px
1440px+

### Deliverable

Create:

`docs/ui-audit.md`

Include:

1. design problems
2. UX problems
3. inconsistencies
4. accessibility concerns
5. responsive concerns
6. strongest existing components worth keeping
7. components needing redesign
8. proposed design principles
9. proposed visual language
10. prioritized improvement plan

Then define a design direction.

Do not create generic mood-board prose.

Be concrete.

Define:

- typography hierarchy
- spacing scale
- radius policy
- elevation policy
- border policy
- neutral color usage
- semantic colors
- surface hierarchy
- content widths
- sidebar dimensions
- table density
- form density
- icon policy
- motion policy

Create or update:

`docs/design-system.md`

Do not perform a massive visual rewrite yet.

Implement only foundational fixes required to establish the design tokens and primitives.

At completion print:

UI PHASE 23 COMPLETE

Then STOP.

---

# UI PHASE 24 — Build a premium design system foundation

Read `docs/ui-audit.md` and `docs/design-system.md`.

Now implement a cohesive design foundation.

### Typography

Create a deliberate typography system.

Define styles for:

- page title
- section title
- card/title text
- body
- secondary body
- table text
- labels
- captions
- numeric/KPI values
- code/IDs where useful

Admin dashboards should feel precise, not oversized.

### Color system

Use restrained neutral surfaces.

Define semantic colors for:

- success
- warning
- danger
- info
- muted
- selected
- hover
- focus
- disabled

Do not encode status meaning only through color.

### Layout primitives

Create reusable layout primitives such as:

PageShell
PageHeader
PageActions
ContentSection
SplitLayout
DetailGrid
StatGroup
Toolbar
FilterBar

Avoid wrapping every section in a generic card.

### Core UI primitives

Review and improve:

Button
Input
Textarea
Select
Combobox
Checkbox
Radio
Switch
Tabs
Badge
Tooltip
Popover
Dropdown
Dialog
Sheet/Drawer
Toast
Skeleton
EmptyState
Alert
Breadcrumb
Pagination

All primitives must have:

- hover
- focus
- active
- disabled
- loading
- error where relevant

### Interaction quality

Create excellent:

- focus rings
- keyboard navigation
- hover feedback
- selected states
- loading transitions

### Icons

Use one icon family consistently.

Define standard sizes.

Remove decorative or redundant icons.

### Dark mode

If the existing application supports dark mode, polish it fully.

If it does not, do not force dark mode into this phase unless architecture already makes it straightforward.

### Story/demo page

Create an internal development-only UI showcase if useful, demonstrating components and states without exposing it in production.

### Validation

Ensure existing screens remain functional.

Run all frontend checks.

Print:

UI PHASE 24 COMPLETE

Then STOP.

---

# UI PHASE 25 — Navigation and application shell redesign

Redesign the Seller and Super Admin shells.

The goal is to make the application feel like a serious operational product.

### Sidebar

Improve:

- grouping
- hierarchy
- active state
- hover state
- icons
- spacing
- collapsed behavior if useful
- role-specific navigation
- notification indicators where meaningful

Do not place every route at the same hierarchy level.

Group features logically.

Example seller navigation:

Overview

Commerce

- Orders
- Products
- Inventory

Growth

- Promotions
- Reviews

Finance

- Overview
- Transactions
- Payouts

Organization

- Staff
- Warehouses

Settings

### Admin navigation

Group:

Overview

Marketplace

- Sellers
- Catalog
- Orders

Operations

- Returns
- Reviews
- Moderation

Finance

- Revenue
- Commissions
- Payouts
- Refunds

Platform

- Users
- Roles
- Audit

Settings

Adapt to actual available features.

### Top bar

Design a restrained top bar.

Possible content:

- breadcrumbs
- contextual title
- search/command access
- notifications
- user menu

Do not duplicate sidebar navigation.

### Command palette

If useful, add a keyboard-accessible command/search palette for navigation and common actions.

Potential shortcut:

Ctrl/Cmd + K

Do not add it unless implemented properly.

### Responsive behavior

Desktop:
persistent navigation where appropriate.

Tablet:
compact navigation.

Mobile:
drawer-based navigation with clear actions.

### Page shell

Make all pages align to a consistent content grid.

Reduce random differences between sections.

Run full checks.

Print:

UI PHASE 25 COMPLETE

Then STOP.

---

# UI PHASE 26 — Dashboards worthy of a premium product

Redesign:

- Seller Dashboard
- Super Admin Dashboard

Do not fabricate data.

Use existing backend metrics.

### Seller dashboard hierarchy

Top section should answer:

"What needs my attention right now?"

Possible priority cards:

- orders needing action
- low-stock variants
- returns awaiting response
- payout status
- moderation issues

Then business performance:

- revenue
- orders
- average order value
- units sold
- platform fees
- available balance

Then trends:

- sales over time
- orders over time

Then operational sections:

- top products
- recent orders
- low stock
- recent reviews

Avoid displaying 12 equal KPI cards.

Establish visual priority.

### Super Admin dashboard

Focus on marketplace operations.

Top priority:

- sellers awaiting approval
- payout actions
- returns/disputes
- moderation queue
- operational alerts

Then platform metrics:

- GMV
- revenue
- commissions
- orders
- sellers
- customers if available

Then trends and breakdowns.

### Charts

Charts must:

- have readable axes
- have useful tooltips
- use restrained colors
- support empty data
- support loading
- avoid unnecessary legends
- work in narrow layouts

Avoid flashy chart gradients.

### Numbers

Use:

- compact formatting where useful
- locale-aware currency
- consistent decimals
- clear comparison periods

### Responsiveness

Dashboards should feel designed at all major breakpoints, not merely stacked.

Run full frontend checks.

Print:

UI PHASE 26 COMPLETE

Then STOP.

---

# UI PHASE 27 — Make tables, search, filters, and bulk workflows exceptional

Administration software succeeds or fails on its tables.

Audit every major DataTable.

Improve:

- column hierarchy
- alignment
- numeric alignment
- row height
- hover
- selected state
- loading
- empty states
- sort indicators
- filter indicators
- pagination
- truncation
- tooltips
- sticky columns only when justified
- responsive behavior

### Search and filtering

Create consistent filter experiences.

Examples:

Product filters:

- status
- category
- stock state
- date updated

Order filters:

- status
- payment status
- fulfillment status
- date
- seller for admins

Seller filters:

- status
- verification
- date joined

Use URL search parameters for important table/filter state where appropriate so views are shareable and browser navigation works.

### Bulk actions

Where backend capabilities safely support them, design bulk selection carefully.

Do not invent destructive bulk APIs that do not exist.

### IDs

Use secondary styling for:

- order numbers
- SKUs
- IDs

Allow easy copy actions where operationally useful.

### Status

Replace inconsistent status labels with a coherent status system.

Status should use:

- text
- semantic visual cue
- accessible labels

### Mobile

Do not squeeze desktop tables into 375px.

For narrow screens, intentionally choose:

- simplified rows
- stacked data
- detail drawers
- horizontal scrolling only where appropriate

Run checks.

Print:

UI PHASE 27 COMPLETE

Then STOP.

---

# UI PHASE 28 — Forms and complex workflows redesign

Audit every major form.

Focus especially on:

- seller onboarding
- product creation/editing
- variants
- inventory adjustments
- seller approval/rejection
- order actions
- return processing
- promotion creation
- role/permission management
- settings

### Form principles

A user must immediately understand:

- what information is required
- why it is required
- what will happen when submitted
- which fields contain errors
- whether changes are saved

### Layout

Do not create 20-field single-column forms without grouping.

Create logical sections.

For complex forms use:

- sections
- tabs where appropriate
- step flows only when genuinely beneficial
- sticky save/action footer where appropriate

### Validation

Improve:

- inline validation
- server error mapping
- field descriptions
- disabled states
- pending states

Do not rely only on toasts for validation.

### Destructive actions

Require explicit confirmation for consequential operations.

Examples:

- suspend seller
- reject product
- cancel order
- remove staff
- approve payout
- refund

Confirmation dialogs must clearly state:

- action
- target
- consequence

Avoid generic:

"Are you sure?"

### Unsaved changes

For important complex forms, warn appropriately if the user attempts to navigate away with unsaved edits.

Do not make this annoying.

### Product editor

Give particular attention to the product editing experience.

It should feel like professional merchant software.

Potential structure:

General
Media
Pricing
Variants
Inventory
Attributes
SEO/status if applicable

Only include features that actually exist.

Run checks.

Print:

UI PHASE 28 COMPLETE

Then STOP.

---

# UI PHASE 29 — Detail pages and operational workflow polish

Redesign detail pages so they feel intentionally composed rather than like database record dumps.

Focus on:

- Seller detail
- Product detail
- Order detail
- Return detail
- Payout detail
- Review detail

### Detail page architecture

A strong detail page should generally contain:

Header

- entity identity
- state
- primary actions

Summary

- most important facts

Main content

- operational details

Secondary panel

- metadata where appropriate

History/timeline

- state changes
- audit events
- relevant activities

### Order detail

Order pages should be exceptionally clear.

Show:

- current fulfillment status
- payment status
- seller context
- customer/shipping information according to permissions
- ordered items
- totals
- timeline
- shipments
- returns/refunds
- available actions

Avoid presenting everything at equal visual prominence.

### Seller detail for Super Admin

Make it an operational workspace.

Show:

- identity
- verification
- current status
- documents
- staff
- catalog summary
- order summary
- financial summary
- audit timeline

Place approval/suspension controls carefully.

### Timelines

Build one coherent timeline primitive for:

- orders
- seller statuses
- returns
- shipments
- audit history

Run checks.

Print:

UI PHASE 29 COMPLETE

Then STOP.

---

# UI PHASE 30 — Microinteractions, motion, and perceived quality

Do a polish pass.

Do not over-animate.

### Improve

- buttons
- dropdown opening
- sidebars
- tabs
- drawers
- modal transitions
- table loading
- skeletons
- status changes
- copy confirmations
- save success
- inline row actions

Animation should communicate:

- hierarchy
- continuity
- state change

Not decoration.

Honor:

`prefers-reduced-motion`

### Loading experience

Remove ugly page jumps.

Use intentionally sized skeletons.

Avoid full-screen spinners where partial skeleton loading is possible.

### Optimistic UI

Use only where operations are safe and failure recovery is clear.

Do not use optimistic behavior for sensitive financial/security actions.

### Feedback

Use appropriate:

- inline state
- toast
- progress
- confirmation

Do not toast absolutely everything.

Run checks.

Print:

UI PHASE 30 COMPLETE

Then STOP.

---

# UI PHASE 31 — Responsive and accessibility mastery

Perform a dedicated responsive/accessibility pass.

Test major workflows at:

375px
430px
768px
1024px
1280px
1440px
1920px

### Accessibility

Audit:

- semantic headings
- form labels
- aria usage
- keyboard navigation
- focus management
- dialogs
- drawers
- menus
- comboboxes
- table interactions
- chart alternatives
- contrast
- disabled state contrast
- status representation
- error messages

Interactive elements must be usable without a mouse.

### Mobile admin

Do not attempt to make every complex desktop workflow identical on mobile.

Prioritize:

- viewing
- triage
- lightweight actions

Complex configuration may remain more desktop-oriented if documented.

But nothing should become unusable.

### Touch

Ensure reasonable tap targets.

### Screen reader

Ensure key workflows are understandable.

Run automated accessibility checks where supported, but also inspect manually.

Run full frontend checks.

Print:

UI PHASE 31 COMPLETE

Then STOP.

---

# UI PHASE 32 — Human-design cleanup pass

Now review the UI specifically for signs that it was mechanically generated.

Inspect every major page visually.

Look for:

- repetitive cards
- repetitive layouts
- excessive badges
- over-rounded controls
- redundant headings
- unnecessary helper text
- fake sophistication
- excessive icons
- inconsistent spacing
- default component-library appearance
- pages that feel cloned from one template
- awkward text wrapping
- visually equal importance for unequal information

Make intentional design adjustments.

### Questions to ask on every screen

What is the user here to accomplish?

What is the most important information?

What is the primary action?

What needs immediate attention?

What can be visually quieter?

What should not be inside a card?

What can be removed?

Could a real operations team use this eight hours per day comfortably?

### Copy

Polish interface copy.

Prefer concise human wording.

Avoid robotic labels such as:

"Perform Action"

when:

"Approve seller"

is clearer.

Avoid unnecessary explanatory paragraphs.

### Density

Ensure operational screens have an efficient professional density.

Not cramped.

Not excessively spacious.

Run all checks.

Print:

UI PHASE 32 COMPLETE

Then STOP.

---

# UI PHASE 33 — Final visual QA and production UI audit

Perform final frontend visual QA.

Do not introduce major new features.

### Review every major route

Capture or inspect all screens at representative viewport sizes.

Check:

- alignment
- spacing
- typography
- clipping
- overflow
- loading
- errors
- empty states
- forms
- tables
- dialogs
- mobile behavior
- dark mode if supported

### Cross-browser assumptions

Review for:

- Chromium
- Firefox
- Safari-compatible CSS behavior

Do not rely unnecessarily on experimental CSS.

### Performance

Inspect:

- bundle size
- client component overuse
- excessive re-renders
- large icon imports
- chart bundle cost
- unnecessary JS
- images
- fonts
- hydration issues

Prefer Server Components where appropriate without compromising interactive UX.

### Consistency audit

Find duplicated components that should be unified.

Find reusable patterns that were copied inconsistently.

Do not over-abstract tiny one-off components.

### Final documentation

Create:

`docs/ui-final-review.md`

Include:

1. design system
2. component architecture
3. navigation system
4. responsive strategy
5. accessibility
6. interaction philosophy
7. major redesigned screens
8. performance considerations
9. known UI limitations
10. future UI opportunities

Run:

frontend tests
lint
typecheck
production build

All must pass.

At completion print:

UI OVERHAUL COMPLETE

Then provide a concise final summary and STOP.
