# Reference palette review

The user supplied an ivory, copper and charcoal reference. The interface now uses `#f4eee6` for the canvas, `#fbf8f2` for surfaces, `#b86a2c` for large display copper and `#1e1a18` for ink. Small text and filled actions use darker copper to meet normal-text contrast. Green is reserved for semantic success states.

Python Playwright captured Chromium screenshots of the actual development app, with no mocked API responses. Computed-style assertions confirmed the canvas, hero, display copper, charcoal and 3px copper keyboard focus at every viewport. No page-wide overflow remained after reducing the mobile header's logo size and gaps. There were no uncaught browser page errors. API response evidence is recorded in [observations.json](observations.json).

All six home captures and both login captures were visually inspected. The cream surfaces, copper brand emphasis and warm charcoal text replace the prior green and blue-gray palette. This review covers the captured anonymous/fallback states; populated catalogs and authenticated workspaces still need live integration verification.

Home screenshots:

- [375px](home-375.png)
- [430px](home-430.png)
- [768px](home-768.png)
- [1024px](home-1024.png)
- [1440px](home-1440.png)
- [1920px](home-1920.png)

Shared authentication surfaces:

- [Login at 375px](login-375.png)
- [Login at 1440px](login-1440.png)

The backend listener at `127.0.0.1:8000` was unavailable: proxied category, product and session requests returned 500. These images verify presentation and fallback states, not successful commerce or authentication. The existing home page presents failed product reads as an empty catalog; that misleading error behavior remains a separate functional issue. The login page correctly shows its session-check failure.

The palette correction stays in a separate worktree because the active `ui-overhaul` checkout contains concurrent user changes and diverges from its remote branch. Integration must preserve those edits and the security-first integration order.
