# Flous Flow POS Keyboard Shortcuts

Native Odoo 20 Point of Sale keyboard shortcuts for cashiers who prefer a
keyboard-first workflow. The addon uses an Owl-managed document keydown
listener and calls the existing POS store, screens and numpad controls; it does
not patch Odoo core or replace barcode, offline, payment or permission logic.

## Installation and configuration

Install `ff_pos_keyboard_shortcuts`, then open **Settings → General Settings**.
Enable **Keyboard shortcuts** once; the global setting is loaded by every POS
configuration and every new POS session. The defaults are deliberately disabled
until a manager enables them, so installing the addon cannot change an existing
cashier workflow unexpectedly.

The optional global JSON bindings field accepts command names such as
`product_search`, `customer`, `quantity`, `line_discount`, `price`, `payment`,
`numpad`, `new_order`, `orders`, `order_discount` and `help`. Use **Restore defaults**
to return to the supported mapping. The same mapping is used by all POS
configurations; it is not duplicated per shop.

## Default mapping

| Command | Windows / Linux | MacBook |
| --- | --- | --- |
| Product search | Shift+F | Option+F |
| Order lines | Shift+L | Option+L |
| Customer | Shift+C | Option+C |
| Numpad / POS controls | Shift+K | Option+K |
| Quantity | Shift+Q | Option+Q |
| Line discount | Shift+D | Option+D |
| Order discount | Shift+O | Option+Shift+D |
| Price | Shift+P | Option+P |
| Payment | Shift+E | Option+Enter |
| Orders / history | Shift+H | Option+O |
| New order | Shift+N | Option+N |
| Help | Shift+J | Option+/ |

Inside the Product screen, Up/Down navigate the native product results or
order-line list. The selected order line is updated through the standard POS
store and the focused line is scrolled into view. When a numpad button has
focus, all four arrow keys move through its four-column grid; Enter continues
to activate the native button. Enter activates any focused POS button, product,
or order line. Outside
these lists, Escape, Tab and the number buffer remain owned by native POS
components.

The shortcut help window is available from the POS menu and shows the Windows /
Linux form using `Shift` plus a letter alongside the MacBook form using Option
(`⌥`) plus letter keys. Mac shortcuts intentionally avoid the function row so
they are not affected by macOS brightness/audio key settings.
Shortcuts are scoped to the focused POS tab and an active POS session; they do
not run while another browser tab/window is focused.

The same focus path includes the POS control row above the numpad (more,
upload, notes and customer): Left/Right move across that row, Down enters the
matching numpad column, and Up returns to the control row. An open dialog must
be closed first so its own keyboard controls remain isolated.

Other visible, focusable POS buttons also support spatial arrow navigation, so
the header actions and product controls can be reached without leaving the
keyboard focus context.

On the Payment screen, `Shift+E` (or `Option+Enter` on MacBook) focuses the
first payment method. Arrow keys move between payment methods and the customer,
invoice, back and validation controls; Enter activates the focused control.
`Escape` activates the visible native POS back button even when a text field has
focus. Inside dialogs, `Escape` first dismisses the top dialog through Odoo's
native cancel behavior; pressing it again returns from the underlying screen.
Dialogs that intentionally disable Escape dismissal keep that protection.

Customer-selection dialogs are keyboard-friendly as well: `ArrowUp` and
`ArrowDown` move through the customer list (and then to the dialog actions),
while `Enter` selects the focused customer or activates the focused dialog
button. From the customer search field, `ArrowDown` focuses the first result;
the native search action remains assigned to `Enter`. In partner forms,
`ArrowUp` and `ArrowDown` move between controls and `Enter` advances to the next
control. Left/Right and open autocomplete menus remain under native browser
control.

The payment confirmation/receipt screen also keeps keyboard focus in its
action row. `ArrowLeft` and `ArrowRight` move between Return, Send Receipt,
Print and Continue (in the current RTL layout), and `Enter` activates the
focused action.

The shortcut reference itself is scrollable and keyboard-navigable. `ArrowUp`
and `ArrowDown` focus each shortcut row and scroll it into view; `Escape`
closes the reference dialog.

Arrow navigation also initializes focus when the page has no active control:
the first arrow press selects the nearest visible POS control in that direction,
so the cashier is never left with an unselected screen.

From the product search field, `ArrowDown` moves focus to the first visible
product and `ArrowUp` to the last. `Escape` leaves the search field and focuses
the first result (or simply blurs the field when the search has no results);
the search text is preserved. Press `Enter` on a focused product to add it.

## Compatibility

The module has no dependency on `ff_pos_advanced_discounts`. When that addon
is installed, its existing numpad discount behavior remains responsible for
discount calculations; this addon only activates the corresponding native
button. All actions remain subject to the POS user's access rights.
