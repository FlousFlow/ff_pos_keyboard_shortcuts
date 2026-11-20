# Odoo 20 Engineering Log

## 2026-11-19 — Resume and consistency check

- Module: `ff_pos_keyboard_shortcuts` 20.0.1.0.1.
- Evidence: local Odoo 20 instance on `127.0.0.1:8070` has the module installed; the POS menu exposes the shortcut reference dialog with Windows/Linux and MacBook columns.
- Decision: keep the global settings model and the POS-tab/document listener design; it prevents shortcuts from running outside the focused active POS.
- Corrections: aligned the Python default-binding test with the actual `control+shift+f2` default and corrected README wording to describe the Owl document listener.
- Follow-up fix: function-key shortcuts now remain allowed while a POS input/editor has focus; the previous prefix check incorrectly blocked `Command/Ctrl + Shift + F2..F10` in that state.
- Runtime fix: the debug POS widget is not a modal; excluding it from the dialog guard restored keyboard events in `debug=assets`. Verified `Command + Shift + F4` and `Ctrl + Shift + F4` opened the customer selector in the local POS.
- Mac mapping: all Mac shortcuts now use Option (`⌥`) as the primary modifier; line discount is `⌥+⇧+F7` and order discount is `⌥+F7` to keep the commands unique. Verified `Option + Shift + F4` opened the customer selector.
- Simplified Mac mapping: standard commands now use Option alone (`⌥+F-key`); only order discount uses `⌥+⇧+F7` because line discount owns `⌥+F7`. Verified `Option + F4` in the visible POS tab.
- Compatibility hardening: Option/AltGraph is accepted even when the browser platform string is not reported as macOS. The visible in-app POS still opens the customer selector with a synthetic Option+F4 event; a real keyboard must be sent while the POS tab/window has focus.
- Physical-key fallback: Mac defaults now avoid the function row entirely (`Option+F`, `Option+C`, `Option+N`, etc.); the visible POS verified `Option+C` opening the customer selector.
- Boundary: physical keyboard tests for every browser/OS combination are not performed here; browser UI rendering was verified in the local POS.

## 2026-11-19 — Windows-safe bindings and spatial focus

- Decision: replace Windows/Linux function-row defaults with `Ctrl+Alt+Shift` letter bindings to avoid browser-reserved combinations such as Ctrl+F, Ctrl+N, and function-key behavior.
- UX: add spatial arrow navigation for all visible focusable POS controls, while retaining specialized product, order-line, control-row and numpad navigation.
- Verification: local POS loaded the new asset; `Option+K` focused the numpad and arrow navigation moved across header/control/numpad contexts. Windows physical hardware was not available for verification.

## 2026-11-19 — Shift-letter Windows map

- Decision: simplify the Windows/Linux map to `Shift` plus a unique letter only, including `Shift+E` for payment and `Shift+J` for help, per cashier usability feedback.
- Runtime: updated the global bindings parameter in `ff_demo_local20`, restarted the local Odoo process to clear the parameter cache, and verified the help dialog after reload.
- Revision: simplified the Windows/Linux map again to `Shift` plus a letter only; refreshed the database parameter and verified `Shift+J` opens help and `Shift+K` focuses the numpad.
- Smoothness: replaced the fixed order-line focus delay with two animation frames, preserving the Odoo rerender boundary while removing the visible 150ms pause.
- Enter behavior: focused POS buttons, products and order lines now activate once from Enter; editable fields remain native and are not intercepted.
- Enter review: narrowed activation to actual buttons, role-buttons, products and order lines; generic non-action `tabindex` elements and aria-disabled controls are no longer consumed.
- Boundary navigation: when Up/Down reaches the first or last item in a list, the event now falls through to spatial navigation; aligned candidates are preferred so Down from the last order line enters the POS controls rather than jumping to the product grid.
- RTL translations: added an Arabic runtime fallback for the shortcut dialog labels/title because the local Odoo 20 translation loader reported no imported `ar_001` entries during module upgrade; verified the complete Arabic table in the POS.
- Payment screen: `Shift+E`/`Option+Enter` now focuses the first native payment method; spatial arrows and Enter then operate the payment methods and customer/invoice/back/validation controls. Verified cash -> card -> invoice movement locally.
- Customer dialog: Up/Down now move through the native `.partner-info` list and then the dialog actions; Enter activates the focused customer/action without intercepting the search input. Verified in the local payment-screen customer chooser: search -> Brandon Freeman -> Acme Corporation, then Enter closed the dialog and selected Acme Corporation.
- Receipt confirmation: added focus initialization and spatial navigation for the native feedback-screen action row. In RTL, Left/Right move Return -> Print -> Send Receipt -> Continue, and Enter activates the focused action. Verified Enter on Send Receipt opened the native receipt dialog.
- Shortcut reference: added a bounded scroll container, row focus styling, Up/Down row navigation with automatic scrolling, and Escape-to-close. Upgraded `ff_pos_keyboard_shortcuts` in `ff_demo_local20` and restarted Odoo so the updated Owl template/assets are loaded. Browser re-verification is pending a fresh login because the previous session was invalidated by the restart.
- Focus initialization: spatial arrow navigation now selects a nearest visible POS control even when focus is on the document/body or a non-actionable wrapper; existing product/orderline/numpad-specific navigation remains first priority.
- Apps readiness review: renamed the listing title to the vendor-guideline-compatible `POS Keyboard Shortcuts` (25 characters or fewer), added `support`, `images`, an English HTML description, and a generated cover asset. Removed generated Python caches from the addon package. Verified manifest parsing, XML parsing, JavaScript syntax, Python compilation, and the Odoo 20 post-test suite (3 test classes, 5 tests, 0 failures). Real Apps Store scan/submission and real cashier screenshot capture remain unverified.
- Listing visuals: added a cover and a three-panel English feature-overview visual under `static/description/images/`, linked from both the manifest `images` key and the HTML description. The visuals document the implemented flows; they do not replace final Apps Store acceptance or a live UI capture review.
- Final upgrade check: `ff_pos_keyboard_shortcuts` loaded and all 3 post-test classes (5 tests) passed with 0 failures. The database still reports the pre-existing unrelated `flousflow_accounting` module as not installable; no new module error was introduced.
- Runtime screenshots: opened the local POS session, verified the shortcut dialog has 12 rows and focused-row navigation, verified `Shift+E` opened the Payment screen with 3 payment methods, and captured cropped POS screenshots for the Apps description. The backend still shows a pre-existing malformed-view warning unrelated to this addon.


## 2026-11-19 — Fix shortcut stylesheet build and compress web assets

- Module/version: `ff_pos_keyboard_shortcuts` 20.0.1.0.2.
- Root cause: the backend stylesheet used Sass `min(65vh, 560px)`, which Odoo Sass evaluated numerically and rejected with `Incompatible units: px and vh`. This caused `web.assets_web` compilation to fall back to its old style.
- Fix: quote the CSS `min()` expression with Sass `unquote()` so the browser evaluates it. Enable Nginx gzip for CSS, JavaScript, JSON, and XML responses; HTML was the only compressed content type before.
- Verification: Odoo asset bundle request returned HTTP 200 and included the addon stylesheet; Sass compilation error was present in production logs. Full post-fix verification is recorded after deployment.

## 2026-11-21 — Arrow and Enter navigation across POS screens

- Module/version: `ff_pos_keyboard_shortcuts` 20.0.1.0.3.
- Behavior: spatial arrow navigation now covers visible native controls and POS-specific clickable elements across screens and dialogs; Enter activates the focused action.
- Input handling: arrow keys remain native while an editable field is focused, and Odoo's native Enter handling remains in control for editable fields and the NumberPopup input.
- Verification: JavaScript syntax and whitespace checks are required before release. Interactive browser verification and deployment are still pending.

## 2026-11-21 — Navigate product cards by visual grid position

- Module/version: `ff_pos_keyboard_shortcuts` 20.0.1.0.4.
- Root cause: Up/Down treated the product grid as a flat list, so each key moved only one DOM item regardless of the card's row and column.
- Fix: product-card arrows now choose a spatially adjacent card in the same visual row or column across the product pane; order-line navigation remains sequential, and editable search fields retain native arrow behavior.
- Verification: JavaScript syntax and whitespace checks are required before release. Interactive browser verification is pending.
