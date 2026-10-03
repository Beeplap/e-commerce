# UI phase selector

UI PHASE 32 — human-design cleanup

Phase 31 implementation is complete: named controls, keyboard tabs, full exact chart alternatives, native warehouse modality, focus/touch/contrast and responsive triage improvements. Frontend lint, TypeScript, all 182 tests, formatting and production build passed. Begin Phase 32 after the Phase 31 commit and push succeed. Browser discovery still returns no browser. The user directed continuation after being informed of required live QA; proceed with source/automated work while recording all viewport/manual/visual checks as unverified in `docs/ui-accessibility.md`. Do not claim visual acceptance.

Roadmap: `instrutions3.md` (the supplied filename).

Work only on `ui-overhaul`, using the separate `quick-commerce-ui` worktree. The backend `CURRENT_PHASE.md` belongs to the concurrent functional/security roadmap and is not this UI selector.

After a UI phase passes frontend lint, strict TypeScript, all frontend tests, production build and formatting, update its documentation/progress and this selector, commit and push, then continue automatically. A failed check or push blocks advancement. This continuation was explicitly confirmed by the user on 2026-10-03 and replaces intermediate “Then STOP” instructions in the UI roadmap. Finish at Phase 33; do not invent additional phases.

Merge integration is a separate final gate: security/backend work must be clean and tested and merged first, then rebase `ui-overhaul` onto that result. Preserve authorization, tenant isolation, CSRF, validated API responses and genuine frontend functionality during conflict resolution. Do not merge or modify the other worktree's unfinished work.

After Phase 26, critique actual Seller Dashboard screenshots at 1440px and mobile before further dashboard changes when browser access or supplied screenshots are available. Record visual evidence and limitations honestly.
