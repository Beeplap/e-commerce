# instructions4.md

# PREMIUM STOREFRONT REDESIGN ROADMAP

# QuickCommerce / Multi-Vendor Marketplace

## PURPOSE

This document contains the complete redesign plan for the CUSTOMER-FACING STOREFRONT.

The backend, seller admin, super admin, authentication, tenant isolation, RBAC, API contracts, orders, finance, inventory, returns, payouts, security hardening, observability, CI/CD, and deployment architecture already exist.

The current storefront is technically functional but visually too generic, too SaaS-like, and not memorable enough for a consumer marketplace.

The goal of this roadmap is to transform the storefront into a premium, modern, human-designed e-commerce experience with a warm editorial visual identity inspired by the Yarsha Byte reference aesthetic.

This document is intentionally detailed so an advanced coding model can execute the redesign without inventing random visual directions.

---

# EXECUTION RULE

This document contains multiple UI phases.

DO NOT execute every phase automatically in one uncontrolled pass.

Only execute the phase explicitly requested by the user.

If the user says:

> Execute Phase 34

then implement ONLY Phase 34.

At the end of each phase:

1. run the required checks,
2. visually inspect the affected pages,
3. update `docs/progress.md`,
4. document significant design decisions,
5. summarize the work,
6. STOP.

Do not begin the next phase until explicitly requested.

Future phases are context only.

---

# CRITICAL PROJECT RULES

Before modifying code:

1. Read `AGENTS.md`.
2. Read `docs/progress.md`.
3. Read relevant architecture/security docs.
4. Inspect the current storefront routes and components.
5. Preserve backend API contracts.
6. Preserve authentication architecture.
7. Preserve session + CSRF behavior.
8. Preserve authorization and tenant isolation.
9. Preserve exact decimal/money display behavior.
10. Preserve working tests.

Do NOT weaken:

- Django authorization
- CSRF
- sessions
- tenant isolation
- validation
- accessibility
- financial correctness
- inventory correctness
- tests

Do NOT redesign backend architecture as part of this work.

Do NOT convert the storefront to a different frontend framework.

Do NOT use localStorage/sessionStorage for authentication.

Do NOT invent fake backend data or fake metrics.

---

# DESIGN GOAL

The storefront should feel:

- premium
- editorial
- warm
- sophisticated
- trustworthy
- fast
- contemporary
- memorable
- highly shoppable
- human-designed
- intentionally composed
- polished enough to feel like a real funded consumer product

It must NOT feel:

- like a generic SaaS landing page
- like a dashboard
- like a default shadcn demo
- like a bootstrap template
- like an AI-generated startup homepage
- overly rounded
- overly card-based
- gradient-heavy
- purple/blue startup-themed
- cluttered
- juvenile
- excessively animated
- visually repetitive

The user should feel:

> "This marketplace is curated, reliable, modern, and worth browsing."

---

# VISUAL INSPIRATION

Use the visual language of the Yarsha Byte reference:

- warm ivory / cream background
- copper / burnt-orange primary accent
- warm near-black typography
- tan / beige secondary surfaces
- editorial typography
- large but controlled display type
- understated UI chrome
- restrained visual noise
- sophisticated negative space
- premium contrast
- minimal gradients
- strong composition

DO NOT copy Yarsha Byte's exact page layout.

This is an e-commerce marketplace, not a creative agency portfolio.

Borrow the visual identity and design discipline, not the page structure.

---

# PRIMARY COLOR SYSTEM

Use these as the initial source-of-truth design tokens for the CUSTOMER STOREFRONT.

```css
--background: #f4eee6;
--surface: #f8f3ed;
--surface-strong: #eee3d7;

--foreground: #1e1a18;
--foreground-soft: #3a332e;
--muted-foreground: #756a61;

--primary: #b86a2c;
--primary-hover: #9f5822;
--primary-active: #864818;

--accent: #c6a07d;
--accent-soft: #e6d1be;

--border: #dec7b0;
--border-strong: #cbb092;

--dark-surface: #241e1a;
--dark-surface-soft: #312925;

--success: #3f6b52;
--warning: #b77a2a;
--danger: #a5463d;
--info: #4e6778;

--focus: #8d4e1f;
```

Do not use copper everywhere.

Use copper mainly for:

- primary CTA
- active states
- important accents
- selected navigation
- editorial highlights
- occasional price or promo emphasis

Use near-black for most typography.

Use cream for the primary canvas.

Use tan and subtle beige for supporting surfaces.

Do not replace semantic success/warning/danger colors with brand copper.

---

# COLOR USAGE POLICY

### Primary background

Use warm cream, not pure white, for most storefront pages.

### White

Use pure white rarely and intentionally.

### Copper

Do not flood entire sections with copper.

### Dark sections

Use `#241E1A` or similar dark espresso tones for:

- footer
- occasional editorial banners
- high-contrast promotional sections

Avoid the current teal/navy visual identity on the customer storefront.

The seller admin and super admin may retain a more operational/neutral palette.

---

# TYPOGRAPHY DIRECTION

The storefront should use two complementary typographic roles:

1. Editorial display typography
2. Highly readable commerce/UI typography

The display type should feel premium and distinctive.

The UI/body type should remain practical and legible.

Do not use oversized hero text just because it looks dramatic.

Typography must remain useful for shopping.

Recommended hierarchy:

```text
Display XL
Hero merchandising headline

Display L
Campaign / category headlines

H1
Page titles

H2
Section titles

H3
Product/category group titles

Body
General copy

Body Small
Secondary copy

Label
UI controls / filters

Caption
Metadata / seller / stock / delivery details
```

Numeric values such as prices and totals should have intentional weight and alignment.

Avoid excessively bold text everywhere.

---

# SPACING SYSTEM

Use a consistent spacing scale.

Example:

```text
4
8
12
16
20
24
32
40
48
64
80
96
120
```

Do not invent random spacing values unless necessary.

Use more generous spacing in editorial sections.

Use tighter spacing in commerce-heavy/product-dense areas.

---

# RADIUS POLICY

Avoid giant rounded cards everywhere.

Use approximately:

```text
Small controls: 8-10px
Inputs/buttons: 10-12px
Product imagery: 10-16px
Large editorial surfaces: 16-24px only when composition benefits
```

Do not make every surface pill-shaped.

---

# SHADOW POLICY

Use shadows sparingly.

Prefer:

- subtle borders
- surface contrast
- hover movement
- tonal separation

Avoid:

- strong floating cards
- giant soft shadows
- glassmorphism
- unnecessary elevation

---

# BORDER POLICY

Use warm borders.

Borders should be subtle and quiet.

Do not outline every section.

Use dividers only when they improve scanability.

---

# ICON POLICY

Use one icon family consistently.

Keep standard icon sizes.

Do not decorate every text label with an icon.

Icons should clarify actions.

---

# MOTION POLICY

Motion must communicate:

- state changes
- continuity
- hierarchy
- added-to-cart feedback
- panel opening/closing
- subtle product interaction

Do not animate for decoration.

Honor:

```css
prefers-reduced-motion
```

---

# STOREFRONT INFORMATION ARCHITECTURE

The storefront should ultimately support:

```text
Home
Shop / All Products
Categories
Category Detail
Featured / New
Seller Directory
Seller Storefront
Product Detail
Search Results
Cart
Checkout
Customer Account
Orders
Wishlist if implemented
Reviews
Help / policies
```

Only build routes that already exist or are explicitly within the current project scope.

Do not invent unsupported backend features.

---

# DESKTOP HEADER DIRECTION

Redesign the current header.

Do not let the search box dominate the entire visual identity.

Suggested hierarchy:

```text
Announcement Bar

Logo
Shop
Categories
Featured / New
Sellers

Search
Account
Cart
```

Possible layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Free delivery over ...                    Help / Track Order │
├──────────────────────────────────────────────────────────────┤
│ LOGO   Shop  Categories  New  Sellers      Search  User Cart │
└──────────────────────────────────────────────────────────────┘
```

Requirements:

- clean
- restrained
- responsive
- keyboard accessible
- no duplicated navigation
- clear active states
- search easy to find without visually swallowing the nav

On mobile:

- compact brand row
- search remains easy to access
- use a drawer for navigation
- preserve cart visibility

---

# ANNOUNCEMENT BAR

Use only if meaningful.

Examples:

- free delivery threshold
- seasonal campaign
- trusted seller promise
- delivery promise

Do not stuff multiple messages into a ticker.

---

# HERO DIRECTION

Remove the current teal/navy gradient hero.

No gradient background.

Use:

- warm cream
- strong dark typography
- restrained copper accent
- product/editorial image composition
- clear primary CTA
- quieter secondary action

Possible copy direction:

> Good things.\
> Delivered without the wait.

Supporting:

> Shop verified sellers with live inventory, transparent reviews and fast delivery.

Primary CTA:

> Shop now

Secondary CTA:

> Explore sellers

Alternative direction:

> Everything you need,\
> from sellers you can trust.

Do not hardcode copy if current brand messaging suggests something better.

The hero should not consume the entire viewport.

Users should see hints of products/categories below the fold.

---

# PRODUCT DISCOVERY PRIORITY

The homepage must quickly help users SHOP.

After the hero, prioritize:

1. categories
2. featured/trending products
3. curated collections
4. sellers
5. trust/value propositions

Do not spend most of the homepage on brand storytelling while hiding products.

---

# PRODUCT CARD RULES

Product cards are critical.

Priority:

1. product image
2. product name
3. seller or brand
4. current price
5. previous price if applicable
6. rating if real
7. delivery/stock information only if useful
8. action affordance if appropriate

Avoid:

- excessive badges
- excessive borders
- giant cards
- too much metadata
- strong shadows
- huge Add to Cart buttons on every card unless UX testing supports it

Use warm neutral image backgrounds.

Product cards should be visually quiet enough that the merchandise dominates.

Hover can include:

- subtle image scale
- mild border/elevation change
- action reveal
- text color shift

Keep movement subtle.

---

# CATEGORY CARD RULES

Category sections should feel editorial.

Avoid rows of identical white rounded rectangles.

Possible approaches:

- image-led tiles
- text + image split
- asymmetric but controlled grid
- occasional large feature category
- compact secondary category links

Maintain consistent image ratios.

---

# SELLER DISCOVERY RULES

Marketplace sellers should feel trustworthy.

Show useful information such as:

- seller name
- logo
- verified status
- primary category
- rating if real
- delivery or location info only if relevant

Do not plaster "Verified" badges everywhere.

Use one elegant trust treatment.

---

# TRUST SYSTEM

Trust should be communicated quietly through:

- verified seller indication
- live stock
- customer reviews
- clear returns
- transparent delivery
- secure checkout
- refund policies

Do not create a huge "TRUSTED!" section with generic icons.

---

# FOOTER DIRECTION

Use a dark espresso footer.

Suggested groups:

```text
Shop
Customer
Sell with us
Company
Legal
Social
```

Also include:

- support links
- returns
- shipping
- privacy
- terms

Keep typography clean and organized.

---

# PHASE 34 — STOREFRONT DESIGN AUDIT

Do not redesign immediately.

First inspect the existing customer storefront.

Audit all available routes.

Review:

- homepage
- shop/product listing
- search
- categories
- product detail
- cart
- checkout if implemented
- auth pages if customer-facing
- seller store pages
- customer account routes

Evaluate:

### Brand problems

- current teal/navy identity
- generic SaaS appearance
- weak brand memorability
- inconsistent visual tone

### Layout

- hierarchy
- spacing
- line lengths
- max widths
- section rhythm
- excessive empty space
- cramped content

### Typography

- hierarchy
- readability
- editorial character
- price prominence
- metadata hierarchy

### Product discovery

- speed to products
- category visibility
- seller discovery
- search prominence
- filter usability

### Commerce UX

- add to cart
- variants
- quantity
- stock
- price
- delivery
- reviews
- seller identity

### Responsive

Inspect:

375px
430px
768px
1024px
1440px
1920px

### Accessibility

Review:

- contrast
- keyboard
- focus
- headings
- landmark structure
- form labels
- dialog behavior
- accessible names

Create:

`docs/storefront-ui-audit.md`

Include:

1. visual weaknesses
2. UX weaknesses
3. inconsistencies
4. responsiveness problems
5. accessibility concerns
6. strongest components worth preserving
7. components requiring redesign
8. proposed visual direction
9. route-by-route recommendations
10. implementation priority

Do not execute a full redesign yet.

At completion print:

STOREFRONT PHASE 34 COMPLETE

Then STOP.

---

# PHASE 35 — DESIGN TOKENS AND STOREFRONT FOUNDATION

Implement the new design foundation.

### Required

Create or update customer storefront design tokens.

Centralize:

- colors
- typography
- spacing
- radius
- borders
- surfaces
- focus
- animation timing

Do not scatter raw hex values across page components.

### Remove legacy theme

Remove teal/navy storefront colors where they represent the old visual identity.

Do not blindly change seller/admin dashboard colors.

### Shared customer UI primitives

Review or create:

- storefront button
- text input
- search
- select
- quantity control
- badge
- price
- rating
- seller identity
- product image shell
- breadcrumb
- section header
- modal
- drawer
- toast
- skeleton
- empty state

Do not duplicate generic admin components when consumer-specific behavior is needed.

### Documentation

Create:

`docs/storefront-design.md`

Include:

- palette
- typography
- spacing
- component rules
- product card rules
- responsive rules
- accessibility rules

Run checks.

Visually inspect a representative sample.

Print:

STOREFRONT PHASE 35 COMPLETE

Then STOP.

---

# PHASE 36 — HEADER, NAVIGATION, SEARCH, AND FOOTER

Redesign the global customer shell.

### Header

Implement:

- announcement bar
- premium navigation
- compact brand identity
- Shop
- Categories
- Featured/New if useful
- Sellers
- Search
- Account
- Cart

Do not let search dominate the entire desktop header.

### Search

Search must remain prominent and easy.

Desktop options:

- compact expanded search
- expandable search interaction
- inline search integrated into nav

Mobile:

- easy search access
- full-width search where appropriate

### Cart

Show:

- cart icon
- item count
- clear accessible label

Do not use a visually noisy badge.

### Mobile nav

Use a proper drawer.

Include:

- primary nav
- account
- seller link if relevant
- cart
- search

### Footer

Build a polished warm/dark footer.

Do not use generic 4-column boilerplate if the actual link architecture differs.

### Validation

Visually inspect:

- desktop
- tablet
- mobile

Run all checks.

Print:

STOREFRONT PHASE 36 COMPLETE

Then STOP.

---

# PHASE 37 — HOMEPAGE REDESIGN

Completely redesign the storefront homepage.

### Required composition

1. announcement/header
2. editorial hero
3. featured categories
4. curated/trending products
5. featured sellers
6. promotional/editorial merchandising block
7. trust/value proposition
8. footer

Only use sections backed by real data or safe static brand content.

Do not invent fake statistics.

### Hero

Use:

- cream background
- strong dark typography
- copper accents
- curated product/lifestyle composition if assets exist

Avoid:

- gradients
- giant empty right side
- generic SaaS hero
- full-screen height
- giant badge-first design

### Categories

Make category discovery immediate.

### Product showcase

Show real products where data exists.

Handle zero products elegantly.

Do NOT leave a giant empty "0 of 0 products" block as the main homepage experience.

If catalog is empty in development:

- show a polished empty/demo-state message
- clearly indicate data is unavailable
- do not fake real products unless test/demo fixtures are intentionally loaded

### Seller showcase

Emphasize seller identity and trust.

### Trust block

Keep concise.

Potential themes:

- verified sellers
- real inventory
- transparent reviews
- dependable returns

### Visual QA

Capture or inspect:

- 1440px
- 1024px
- 768px
- 430px
- 375px

Critique:

- hierarchy
- balance
- whitespace
- visual personality
- product prominence

Iterate before calling complete.

Print:

STOREFRONT PHASE 37 COMPLETE

Then STOP.

---

# PHASE 38 — PRODUCT LISTING, CATEGORY, AND SEARCH EXPERIENCE

Redesign product discovery pages.

### Listing page

Include:

- concise heading
- result count
- sort
- filters
- product grid
- pagination
- responsive behavior

### Filters

Desktop:

- left rail or horizontal toolbar depending on actual information density

Mobile:

- filter drawer

Keep active filters visible.

Use URL search parameters where appropriate.

### Product grid

Ensure:

- consistent image ratios
- clean spacing
- readable names
- seller identity
- price hierarchy
- rating
- stock/delivery only if useful

### Empty state

A no-results page should help the shopper recover.

Offer:

- clear message
- reset filters
- category suggestions
- search alternative

Do not show a barren blank page.

### Search

Improve:

- query state
- result count
- loading
- empty state
- keyboard experience

Do not fake autocomplete unless backend supports it.

### Visual QA

Inspect multiple viewport sizes.

Run checks.

Print:

STOREFRONT PHASE 38 COMPLETE

Then STOP.

---

# PHASE 39 — PRODUCT DETAIL PAGE

Make the product detail page premium and conversion-oriented.

### Desktop layout

Recommended:

Left:

- large product gallery
- thumbnails

Right:

- product name
- seller
- rating/reviews
- price
- previous price if applicable
- variants
- stock
- delivery
- quantity
- Add to Cart
- Buy Now only if backend supports it

Below:

- description
- specifications
- seller info
- reviews
- related products

### Product gallery

Use high-quality image handling.

Support:

- loading
- missing image
- multiple images

Do not create complex zoom unless useful and stable.

### Price

Price must be highly legible.

Use exact backend values.

Never recompute money in floats.

### Variants

Variant selection should be obvious and accessible.

Unavailable variants must be distinguishable.

### Add to cart

Primary CTA should be unmistakable.

Copper primary button is appropriate here.

### Seller trust

Show seller identity elegantly.

### Delivery

Do not promise delivery timing that backend does not provide.

### Mobile

Create an intentional mobile layout.

Consider sticky Add to Cart only if it improves usability and does not obscure content.

### Visual QA

Inspect real products if fixtures exist.

Print:

STOREFRONT PHASE 39 COMPLETE

Then STOP.

---

# PHASE 40 — CART EXPERIENCE

Redesign the cart.

This is a multi-vendor marketplace.

Group products by seller where appropriate.

### Cart line item

Show:

- image
- product
- variant
- seller
- quantity
- price
- remove
- availability issues

### Seller grouping

Make seller grouping visually clear but not noisy.

### Summary

Show:

- subtotal
- discounts
- shipping estimate if supported
- taxes if known
- total

Do not display fake amounts.

### Interaction

Quantity changes need:

- pending state
- error handling
- inventory validation

### Empty cart

Make it useful.

Provide a path back to shopping.

### Mobile

Cart must be especially clean on mobile.

Avoid squeezed desktop tables.

Print:

STOREFRONT PHASE 40 COMPLETE

Then STOP.

---

# PHASE 41 — CHECKOUT VISUAL EXPERIENCE

Only implement if checkout already exists.

Do not alter payment/security architecture casually.

### Checkout priorities

1. clarity
2. trust
3. speed
4. error recovery

### Structure

Possible sections:

- contact/customer
- shipping address
- delivery
- payment
- order review

Use steps only if existing checkout workflow supports them.

### Order summary

Keep visible on desktop where useful.

On mobile:

- collapsible summary if needed

### Validation

Use inline errors.

Do not rely only on toast messages.

### Security

Do not expose sensitive values.

Do not trust client-calculated totals.

Backend remains authoritative.

### Trust

Use restrained messaging around:

- secure checkout
- returns
- delivery
- seller verification

Print:

STOREFRONT PHASE 41 COMPLETE

Then STOP.

---

# PHASE 42 — CUSTOMER AUTH AND ACCOUNT POLISH

Only redesign existing customer-facing account functionality.

### Auth

Polish:

- sign in
- sign up if supported
- forgot/reset password if supported
- verification states

Do not alter auth architecture.

### Account

Polish:

- profile
- addresses
- orders
- order detail
- saved items if supported

Use the same warm editorial brand, but keep account pages more operational and compact.

Do not make order history look like a marketing page.

Print:

STOREFRONT PHASE 42 COMPLETE

Then STOP.

---

# PHASE 43 — MICROINTERACTIONS AND PERCEIVED QUALITY

Perform a careful polish pass.

Improve:

- button states
- image loading
- navigation transitions
- menu opening
- cart drawer
- add-to-cart feedback
- product hover
- quantity controls
- filter drawer
- toast behavior
- skeletons
- modal transitions

Do not over-animate.

Honor reduced motion.

Avoid full-screen spinners where local skeletons are better.

Print:

STOREFRONT PHASE 43 COMPLETE

Then STOP.

---

# PHASE 44 — RESPONSIVE AND ACCESSIBILITY MASTER PASS

Test at:

- 375px
- 430px
- 768px
- 1024px
- 1280px
- 1440px
- 1920px

Audit:

- header
- navigation
- search
- product cards
- category cards
- filters
- product detail
- cart
- checkout
- auth
- account

Accessibility:

- landmarks
- heading order
- form labels
- accessible names
- focus management
- keyboard navigation
- dialog behavior
- drawers
- contrast
- reduced motion
- errors
- status semantics

Automated accessibility checks may be used, but do not rely on them alone.

Print:

STOREFRONT PHASE 44 COMPLETE

Then STOP.

---

# PHASE 45 — HUMAN-DESIGN CLEANUP

Review the storefront specifically for visual signs of AI/template generation.

Look for:

- too many cards
- too many rounded rectangles
- too many badges
- repeated identical sections
- arbitrary icons
- generic headings
- repetitive CTA placement
- excessive empty space
- overuse of muted gray text
- every section centered
- excessive symmetry
- copy that sounds robotic
- random gradients
- unnecessary glass effects
- default component-library appearance

For each screen ask:

1. What is the shopper trying to accomplish?
2. What should attract attention first?
3. Is product discovery easy?
4. Is the product visually dominant enough?
5. Is there unnecessary UI chrome?
6. Does this feel like a real brand?
7. Could anything be removed?
8. Is there enough visual rhythm?
9. Is this comfortable for repeat customers?
10. Does this feel designed rather than generated?

Polish copy.

Prefer concise language.

Do not say:

> Perform action

when:

> Add to cart

is enough.

Print:

STOREFRONT PHASE 45 COMPLETE

Then STOP.

---

# PHASE 46 — VISUAL ACCEPTANCE AND FINAL QA

IMPORTANT:

Do NOT declare the storefront complete based only on:

- tests
- lint
- typecheck
- build

Visual acceptance is mandatory.

### Required validation loop

For every major storefront route:

1. run the application,
2. open the page,
3. inspect visually,
4. capture screenshot if tooling allows,
5. critique composition,
6. fix obvious visual issues,
7. inspect again.

### Required desktop review

At minimum inspect:

- homepage
- product listing
- category/search
- product detail
- cart
- checkout if implemented
- account/auth

At:

- 1440px
- 1920px

### Required mobile review

At:

- 375px
- 430px

### Check

- alignment
- composition
- typography
- image ratios
- whitespace
- hierarchy
- CTA emphasis
- color consistency
- visual rhythm
- overflow
- clipping
- sticky elements
- dialogs
- drawers
- filters
- empty states
- loading
- errors

### Cross-browser

Review assumptions for:

- Chromium
- Firefox
- Safari-compatible CSS

### Performance

Inspect:

- client JS
- image optimization
- font loading
- unnecessary client components
- hydration
- chart/library imports if any
- bundle cost

Do not ruin visual quality for tiny premature optimization.

### Final documentation

Create:

`docs/storefront-final-review.md`

Include:

1. final design direction
2. palette
3. typography
4. layout system
5. navigation
6. product discovery UX
7. product card design
8. PDP design
9. cart/checkout design
10. responsive strategy
11. accessibility
12. visual QA performed
13. known limitations
14. next opportunities

### Final checks

Run:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Also run any project-specific frontend validation commands.

Do not hide failures.

At completion print:

STOREFRONT VISUAL OVERHAUL COMPLETE

Then provide:

- major redesigns
- test results
- routes visually inspected
- viewport sizes inspected
- remaining limitations

Then STOP.

---

# ACCEPTANCE STANDARD

The storefront should NOT be considered complete just because:

```text
tests passed
lint passed
build passed
```

Those prove code correctness.

They do not prove design quality.

The actual acceptance process is:

```text
implement
   ↓
run app
   ↓
view page
   ↓
inspect desktop
   ↓
inspect mobile
   ↓
critique
   ↓
iterate
   ↓
re-test
```

If a page is technically correct but looks generic, awkward, visually weak, or template-like, the phase is NOT complete.

---

# FINAL DESIGN PRINCIPLE

The marketplace should make products and sellers feel desirable and trustworthy.

The interface itself should support the shopping experience, not compete with it.

Warm.
Editorial.
Fast.
Clear.
Memorable.
Human.
