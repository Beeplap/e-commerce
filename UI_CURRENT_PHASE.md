# UI phase selector

UI PHASE 33 — final UI audit

Phase 32 implementation is complete: intentional finance hierarchy, restrained record rows, responsive promotion tables, shared administrative tokens and concise copy. Frontend lint, TypeScript, all 185 tests, formatting and production build passed. Begin Phase 33 after the Phase 32 commit and push succeed. Browser discovery still returns no browser. The user directed continuation after being informed of required live QA; proceed with source/automated work while recording all viewport/manual/visual checks as unverified. Do not claim visual acceptance. Produce `docs/ui-final-review.md`, run the full frontend gate, commit/push and finish the UI roadmap without inventing another phase.

Roadmap: `instrutions3.md` (the supplied filename).

Work only on `ui-overhaul`, using the separate `quick-commerce-ui` worktree. The backend `CURRENT_PHASE.md` belongs to the concurrent functional/security roadmap and is not this UI selector.

After a UI phase passes frontend lint, strict TypeScript, all frontend tests, production build and formatting, update its documentation/progress and this selector, commit and push, then continue automatically. A failed check or push blocks advancement. This continuation was explicitly confirmed by the user on 2026-10-03 and replaces intermediate “Then STOP” instructions in the UI roadmap. Finish at Phase 33; do not invent additional phases.

Merge integration is a separate final gate: security/backend work must be clean and tested and merged first, then rebase `ui-overhaul` onto that result. Preserve authorization, tenant isolation, CSRF, validated API responses and genuine frontend functionality during conflict resolution. Do not merge or modify the other worktree's unfinished work.

After Phase 26, critique actual Seller Dashboard screenshots at 1440px and mobile before further dashboard changes when browser access or supplied screenshots are available. Record visual evidence and limitations honestly.
