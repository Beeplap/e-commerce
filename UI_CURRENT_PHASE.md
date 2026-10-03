# UI phase selector

UI PHASE 25 — navigation and application shell redesign

Phase 24 is complete: shared controls, layout helpers, native dialog/drawer foundation, semantic status and accessible field errors. Frontend lint, TypeScript, all 129 tests, formatting and production build passed. Begin Phase 25 after the Phase 24 commit and push succeed.

Roadmap: `instrutions3.md` (the supplied filename).

Work only on `ui-overhaul`, using the separate `quick-commerce-ui` worktree. The backend `CURRENT_PHASE.md` belongs to the concurrent functional/security roadmap and is not this UI selector.

After a UI phase passes frontend lint, strict TypeScript, all frontend tests, production build and formatting, update its documentation/progress and this selector, commit and push, then continue automatically. A failed check or push blocks advancement. This continuation was explicitly confirmed by the user on 2026-10-03 and replaces intermediate “Then STOP” instructions in the UI roadmap. Finish at Phase 33; do not invent additional phases.

Merge integration is a separate final gate: security/backend work must be clean and tested and merged first, then rebase `ui-overhaul` onto that result. Preserve authorization, tenant isolation, CSRF, validated API responses and genuine frontend functionality during conflict resolution. Do not merge or modify the other worktree's unfinished work.

After Phase 26, critique actual Seller Dashboard screenshots at 1440px and mobile before further dashboard changes when browser access or supplied screenshots are available. Record visual evidence and limitations honestly.
