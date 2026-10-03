# UI phase selector

UI PHASE 31 — responsive and accessibility mastery

Phase 30 is complete: sized loading placeholders, geometry-only list reload continuity, confirmed compact clipboard feedback, reduced-motion opening/save/status/tab feedback and corrected wide-dialog width. Frontend lint, TypeScript, all 176 tests, formatting and production build passed. Begin Phase 31 after the Phase 30 commit and push succeed. Phase 31 requires live viewport/manual accessibility checks; browser discovery currently returns no available browser. Record this gap and do not claim those checks passed.

Roadmap: `instrutions3.md` (the supplied filename).

Work only on `ui-overhaul`, using the separate `quick-commerce-ui` worktree. The backend `CURRENT_PHASE.md` belongs to the concurrent functional/security roadmap and is not this UI selector.

After a UI phase passes frontend lint, strict TypeScript, all frontend tests, production build and formatting, update its documentation/progress and this selector, commit and push, then continue automatically. A failed check or push blocks advancement. This continuation was explicitly confirmed by the user on 2026-10-03 and replaces intermediate “Then STOP” instructions in the UI roadmap. Finish at Phase 33; do not invent additional phases.

Merge integration is a separate final gate: security/backend work must be clean and tested and merged first, then rebase `ui-overhaul` onto that result. Preserve authorization, tenant isolation, CSRF, validated API responses and genuine frontend functionality during conflict resolution. Do not merge or modify the other worktree's unfinished work.

After Phase 26, critique actual Seller Dashboard screenshots at 1440px and mobile before further dashboard changes when browser access or supplied screenshots are available. Record visual evidence and limitations honestly.
