# Storefront human-design review (Phase 45)

## Scope and evidence

Phase 45 reviewed the customer home, shop/search, category, seller storefront, product detail, cart, checkout, sign-in, account overview, profile, order history, order detail and address-book screens. The browser review uses deterministic storefront fixtures and Chromium; it checks layout and rendered interaction, not production catalog data or live authentication. Screenshots and machine-readable reports are retained in the ignored `.artifacts/phase45-browser/` directory.

The direct, highest-value cleanups were to remove repeated promotional copy and explanatory blocks from the homepage/footer, make the seller invitation specific, and bring the seller storefront into the same restrained editorial language as product discovery. Seller cards no longer wrap each item in a rounded panel, repeat the seller name, add stock/discount badges, or repeat a “View” button; product image, name, price, real rating and stock remain. The seller header keeps its verified status, location, contact and real rating as plain metadata. Product-list read failures now have a visible retry state. Footer group headings are level two so pages without a second main-content heading keep a valid document outline.

## Ten shopper questions by screen

### Home

1. Shoppers are here to discover products and independent shops.
2. The editorial headline and real latest-arrival image lead.
3. Yes: search, categories, new arrivals and the shop list are direct paths.
4. Yes: the featured item and arrival images lead each product section.
5. The duplicate three-point shopping-clarity section and repeated footer marketing block were removed.
6. Warm cream, copper and display type give the shop a consistent identity.
7. Yes: redundant claims and a second generic marketplace headline are gone.
8. The image-led hero moves into compact category and product lists, then a seller invitation.
9. Search and latest arrivals remain immediately available to returning shoppers.
10. The layout uses real catalog evidence and varied editorial/list compositions.

### Shop, search and category results

1. Shoppers are narrowing a catalog and comparing actual listings.
2. Product photography and product names should lead.
3. Search context, result count, sort and filters stay visible and work at narrow widths.
4. Yes: product images are the largest item in each result.
5. Chrome is limited to the toolbar, optional filter drawer/rail and product information.
6. Shared storefront tokens carry the identity without adding decorative chrome.
7. Sparse results keep their true size; the layout does not invent products to fill space.
8. A left-aligned heading and filter rail balance the product area.
9. The same search, sort and filter controls support repeat visits.
10. Listings retain normal commerce hierarchy instead of dashboard cards.

### Seller storefront

1. Shoppers are deciding whether to browse this seller’s products.
2. The shop name and its merchandise lead.
3. Sorting and seller-scoped products are immediately available.
4. Yes: photos dominate, with real price, review and stock details below.
5. The rounded banner, nested rating card, emoji metadata, item badges and repeated View button were removed.
6. Real location, contact and rating make the shop feel specific.
7. Seller name is no longer repeated on every item; each listing links through its image/name.
8. Plain seller metadata leads into an aligned product grid.
9. Sort and pagination remain available for repeat visits.
10. Seller presentation now shares the editorial storefront language and contains visible read-error recovery.

### Product detail

1. Shoppers are checking the chosen product and its options before adding it.
2. Product image, name, seller, rating and exact price lead.
3. Related products and category links provide discovery paths.
4. Yes: the gallery is the dominant image surface.
5. Variant, quantity and delivery details remain close to the purchase control; claims stay evidence-based.
6. Seller identity and review evidence are tied to the actual listing.
7. Non-applicable single-option controls and invented delivery promises are absent.
8. Purchase information is distinct from the lower details, seller and review sections.
9. Price, availability and variant remain easy to recheck.
10. The page prioritizes the item and the purchase decision over decoration.

### Cart

1. Shoppers are checking quantities and expected charges before checkout.
2. Seller-grouped items and the order summary lead.
3. Quantity, remove, continue shopping and checkout are direct actions.
4. Product thumbnails support item identification without dominating the cart.
5. Summary rows retain shipping/tax uncertainty where the backend has not quoted them.
6. Seller groups, currency and stock are actual cart evidence.
7. Redundant item badges and extra promotional surfaces are absent.
8. Item list and single summary panel distinguish browsing from totals.
9. Clear quantities and prices make returning to an unfinished cart comfortable.
10. The seller grouping fits marketplace behavior rather than a generic single-store cart.

### Checkout and payment review

1. Shoppers are entering delivery details and reviewing the authoritative order.
2. Contact/address steps and the order summary lead.
3. Labels, inline validation and return-to-cart navigation support recovery.
4. Product thumbnails remain secondary to the form and amounts.
5. The page uses numbered sections and one summary surface, not repeated cards.
6. It uses the same warm storefront identity while staying operational.
7. No unquoted total, payment success or delivery date is invented.
8. Form, delivery and summary have distinct reading order.
9. Short field labels and visible order evidence support repeat checkout.
10. The design supports the existing workflow and server-calculated values.

### Sign-in

1. Customers are returning to see orders and saved addresses.
2. “Welcome back” and the sign-in form lead.
3. Back-to-shopping and visible validation provide the needed routes.
4. Product imagery is intentionally absent from this task screen.
5. One form panel contains the necessary inputs; registration/reset are not implied.
6. Editorial display text is balanced with a plain readable form.
7. Unsupported account creation and password recovery are explicitly unavailable.
8. The page pairs account context with the form without repetitive cards.
9. The shared email-based sign-in stays familiar.
10. Copy describes the available action rather than a template workflow.

### Customer account screens

1. Customers are managing orders, profile details, security and saved addresses.
2. The current screen title and its records/actions lead.
3. Account navigation, order links and address controls are direct.
4. Product imagery is secondary to delivery and purchase evidence.
5. Compact record lists and forms avoid marketing chrome.
6. Shared type, color and controls preserve brand continuity.
7. No generic promotional module is added to operational account screens.
8. Details use dividers and whitespace to distinguish sections.
9. Orders, tracking and saved addresses remain easy to find.
10. Account pages remain task-focused and use the customer storefront shell.

## Validation limits

The browser fixtures cover public product/seller data and synthetic signed-in account responses; they do not prove production data quality or authenticated backend workflows. Chromium is the only browser run for this phase. Screen-reader and human shopper testing remain pending. The phase does not change Django, API contracts, authorization, session/CSRF behavior, tenant isolation, money calculations or dependencies.
