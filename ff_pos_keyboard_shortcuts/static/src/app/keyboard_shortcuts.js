import { Component, onWillUnmount, t, useProps } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Chrome } from "@point_of_sale/app/pos_app";
import { BurgerMenuDialog } from "@point_of_sale/app/components/navbar/burger_menu/burger_menu_dialog";

const DEFAULT_SHORTCUTS = {
    new_order: "shift+n",
    product_search: "shift+f",
    order_lines: "shift+l",
    customer: "shift+c",
    numpad: "shift+k",
    quantity: "shift+q",
    line_discount: "shift+d",
    order_discount: "shift+o",
    price: "shift+p",
    payment: "shift+e",
    orders: "shift+h",
    help: "shift+j",
};

const MAC_SHORTCUTS = {
    new_order: "alt+n",
    product_search: "alt+f",
    order_lines: "alt+l",
    customer: "alt+c",
    numpad: "alt+k",
    quantity: "alt+q",
    line_discount: "alt+d",
    order_discount: "alt+shift+d",
    price: "alt+p",
    payment: "alt+enter",
    orders: "alt+o",
    help: "alt+/",
};

const LABELS = {
    new_order: _t("New order"),
    product_search: _t("Product search"),
    order_lines: _t("Order lines"),
    customer: _t("Customer"),
    numpad: _t("Numpad / POS controls"),
    quantity: _t("Quantity"),
    line_discount: _t("Line discount"),
    order_discount: _t("Order discount"),
    price: _t("Price"),
    payment: _t("Payment"),
    orders: _t("Orders / history"),
    help: _t("Show shortcuts"),
};

const ARABIC_LABELS = {
    new_order: "طلب جديد",
    product_search: "بحث عن منتج",
    order_lines: "بنود الطلب",
    customer: "العميل",
    numpad: "لوحة الأرقام / أدوات نقطة البيع",
    quantity: "الكمية",
    line_discount: "خصم البند",
    order_discount: "خصم الطلب",
    price: "السعر",
    payment: "الدفع",
    orders: "الطلبات / السجل",
    help: "عرض الاختصارات",
};

function isMacPlatform() {
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    return /Mac/i.test(platform);
}

function toMacShortcut(binding) {
    const parts = binding.split("+");
    const hasControl = parts.includes("control");
    const hasAlt = parts.includes("alt");
    const key = parts.find((part) => !["control", "alt", "shift"].includes(part));
    if (!hasControl || !key) {
        return binding;
    }
    const modifiers = ["alt"];
    if (hasAlt) {
        modifiers.push("shift");
    }
    return [...modifiers, key].join("+");
}

function readBindings(pos) {
    try {
        const parsed = JSON.parse(pos.config.ff_keyboard_shortcut_bindings || "{}");
        return { ...DEFAULT_SHORTCUTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch {
        return { ...DEFAULT_SHORTCUTS };
    }
}

function visibleElement(selector) {
    return [...document.querySelectorAll(selector)].find((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    });
}

function visibleElements(selector) {
    return [...document.querySelectorAll(selector)].filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
    });
}

const NAVIGABLE_SELECTOR = [
    "button:not([disabled])",
    "[role='button']:not([aria-disabled='true'])",
    "a[href]",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
    // POS uses clickable, non-native elements for these controls.
    ".product",
    ".orderline",
    ".partner-info",
    ".popup-input",
].join(",");

function isEditableElement(element) {
    return Boolean(element?.matches("input, textarea, select, [contenteditable='true']") || element?.isContentEditable);
}

function focusNavigableElement(element) {
    if (!element) return false;
    if (element.matches(".product, .orderline, .partner-info, .popup-input") || element.tabIndex < 0) {
        element.setAttribute("tabindex", "0");
    }
    element.focus();
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    return document.activeElement === element;
}

function findSpatialNeighbor(elements, active, key, origin, requireAlignment = false) {
    const direction = {
        ArrowLeft: { axis: "x", sign: -1 },
        ArrowRight: { axis: "x", sign: 1 },
        ArrowUp: { axis: "y", sign: -1 },
        ArrowDown: { axis: "y", sign: 1 },
    }[key];
    if (!direction || !elements.length) return null;

    const activeElement = elements.find((element) => element === active || element.contains(active));
    const activeRect = activeElement?.getBoundingClientRect();
    const originRect = activeRect || origin?.getBoundingClientRect();
    const originCenter = originRect
        ? { x: originRect.left + originRect.width / 2, y: originRect.top + originRect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const ranked = elements
        .filter((element) => element !== activeElement)
        .map((element) => {
            const rect = element.getBoundingClientRect();
            const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            const primary = (center[direction.axis] - originCenter[direction.axis]) * direction.sign;
            if (primary <= 2) return null;
            const secondaryAxis = direction.axis === "x" ? "y" : "x";
            const secondary = Math.abs(center[secondaryAxis] - originCenter[secondaryAxis]);
            const aligned = activeRect && (direction.axis === "x"
                ? rect.bottom > activeRect.top && rect.top < activeRect.bottom
                : rect.right > activeRect.left && rect.left < activeRect.right);
            return { element, aligned, score: primary + secondary * 0.35 };
        })
        .filter(Boolean)
        .sort((left, right) => left.score - right.score);
    const candidate = ranked.find((item) => item.aligned) || (requireAlignment ? null : ranked[0]);
    return candidate?.element || null;
}

function normalizeShortcutEvent(event) {
    const modifiers = [];
    if ((!isMacPlatform() && event.ctrlKey) || (isMacPlatform() && event.metaKey)) {
        modifiers.push("control");
    }
    if (event.altKey || event.getModifierState?.("AltGraph")) modifiers.push("alt");
    if (event.shiftKey) modifiers.push("shift");
    let key = (event.key || "").toLowerCase();
    if (event.code?.startsWith("F") && /^F\d+$/.test(event.code)) {
        key = event.code.toLowerCase();
    } else if (/^Key[A-Z]$/.test(event.code || "")) {
        key = event.code.slice(-1).toLowerCase();
    } else if (event.code === "Slash") {
        key = event.shiftKey ? "?" : "/";
    }
    return [...modifiers, key].filter(Boolean).join("+");
}

class ShortcutHelpDialog extends Component {
    static template = "ff_pos_keyboard_shortcuts.ShortcutHelpDialog";
    static components = { Dialog };
    props = useProps({
        close: t.function(),
        bindings: t.object(),
    });

    label(command) {
        if (document.body?.classList.contains("o_rtl")) {
            return ARABIC_LABELS[command] || LABELS[command] || command.replaceAll("_", " ");
        }
        return LABELS[command] || command.replaceAll("_", " ");
    }

    dialogTitle() {
        return document.body?.classList.contains("o_rtl")
            ? "اختصارات لوحة المفاتيح"
            : _t("Keyboard shortcuts");
    }

    formatShortcut(binding, mac = false) {
        return binding
            .split("+")
            .map((part) => {
                const values = mac
                    ? { control: "⌘", shift: "⇧", alt: "⌥", escape: "Esc", enter: "↩" }
                    : { control: "Ctrl", shift: "Shift", alt: "Alt", escape: "Esc", enter: "Enter" };
                return values[part] || part.toUpperCase();
            })
            .join(mac ? " " : " + ");
    }

    macBinding(command, binding) {
        return MAC_SHORTCUTS[command] || toMacShortcut(binding);
    }
}

patch(BurgerMenuDialog.prototype, {
    openKeyboardShortcuts() {
        this.props.close();
        this.dialog.add(ShortcutHelpDialog, { bindings: readBindings(this.pos) });
    },
});

patch(Chrome.prototype, {
    setup() {
        super.setup();
        this.ffShortcuts = useService("dialog");
        this.ffShortcutState = { lastCommand: null };
        this.ffShortcutBindings = () => readBindings(this.pos);
        this.ffShortcutEnabled = () => Boolean(this.pos.config.ff_keyboard_shortcuts_enabled);
        this.ffProductScreen = () => this.pos.router.currentScreen() === "ProductScreen";
        this.ffPaymentScreen = () => this.pos.router.currentScreen() === "PaymentScreen";
        this.ffNoDialog = () => document.querySelectorAll(".modal-dialog, .o_dialog").length === 0;
        this.ffFocusPaymentControls = () => {
            const firstMethod = visibleElement(".payment-screen .paymentmethod");
            if (!firstMethod) return false;
            firstMethod.setAttribute("tabindex", "0");
            firstMethod.focus();
            firstMethod.scrollIntoView({ block: "nearest", inline: "nearest" });
            return true;
        };
        this.ffIsActivePos = () =>
            document.visibilityState === "visible" &&
            Boolean(document.querySelector(".pos")) &&
            ["opening_control", "opened"].includes(this.pos.session?.state);
        this.ffRun = (command) => {
            this.ffShortcutState.lastCommand = command;
            return true;
        };
        this.ffNavigateActiveList = (event) => {
            if (!this.ffProductScreen() || !this.ffNoDialog()) return false;

            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            if (isEditableElement(active)) return false;
            const target = event.target instanceof HTMLElement ? event.target : null;
            const activeProduct = active?.closest(".product") || target?.closest(".product");
            const activeLine = active?.closest(".orderline") || target?.closest(".orderline");
            if (activeProduct) return false;
            const lines = visibleElements(".orderline");
            const items = activeLine || lines.some((line) => line.classList.contains("selected"))
                ? lines
                : [];
            if (!items.length) return false;

            const direction = event.key === "ArrowDown" ? 1 : -1;
            const currentItem = activeLine || activeProduct || active || items.find((item) => item.classList.contains("selected"));
            const currentIndex = items.indexOf(currentItem);
            const nextIndex = currentIndex < 0
                ? (direction > 0 ? 0 : items.length - 1)
                : Math.max(0, Math.min(items.length - 1, currentIndex + direction));
            if (nextIndex === currentIndex) return false;
            const next = items[nextIndex];
            if (!next) return false;
            const order = this.pos.getOrder();
            const modelLine = order?.lines?.[nextIndex];
            if (order && modelLine) this.pos.selectOrderLine(order, modelLine);
            const focusRefreshedLine = () => {
                const refreshed = visibleElements(".orderline")[nextIndex];
                refreshed?.setAttribute("tabindex", "0");
                refreshed?.focus();
                refreshed?.scrollIntoView({ block: "nearest" });
            };
            window.requestAnimationFrame(() => window.requestAnimationFrame(focusRefreshedLine));
            return true;
        };
        this.ffNavigateProductGrid = (event) => {
            if (!this.ffProductScreen() || !this.ffNoDialog()) return false;
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return false;

            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            if (isEditableElement(active)) return false;
            const current = active?.closest(".product") ||
                (event.target instanceof HTMLElement ? event.target.closest(".product") : null);
            if (!current) return false;

            const productPane = current.closest(".rightpane");
            const products = visibleElements(".rightpane .product").filter(
                (product) => product.closest(".rightpane") === productPane
            );
            const next = findSpatialNeighbor(products, current, event.key, productPane, true);
            return focusNavigableElement(next);
        };
        this.ffNavigateNumpad = (event) => {
            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const controlButtons = visibleElements(".pads .control-buttons button").sort(
                (left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left
            );
            const paymentButton = visibleElement(".pads .pay-order-button");
            const activeControl = active?.closest(".pads .control-buttons button");
            if (activeControl && event.key === "ArrowDown") {
                const controlIndex = controlButtons.indexOf(activeControl);
                const first = visibleElements(".pads .numpad-button")[Math.max(0, controlIndex)];
                if (!first) return false;
                first.setAttribute("tabindex", "0");
                first.focus();
                return true;
            }
            if (active?.matches(".pads .pay-order-button") && event.key === "ArrowUp") {
                const last = visibleElements(".pads .numpad-button").at(-1);
                if (!last) return false;
                last.setAttribute("tabindex", "0");
                last.focus();
                return true;
            }
            const current = active?.closest(".pads .numpad-button");
            if (!current) return false;

            const buttons = visibleElements(".pads .numpad-button");
            const currentIndex = buttons.indexOf(current);
            if (currentIndex < 0) return false;

            const row = Math.floor(currentIndex / 4);
            const column = currentIndex % 4;
            if (event.key === "ArrowUp" && row === 0 && controlButtons[column]) {
                controlButtons[column].setAttribute("tabindex", "0");
                controlButtons[column].focus();
                return true;
            }
            if (event.key === "ArrowDown" && row === 3 && paymentButton && !paymentButton.disabled) {
                paymentButton.setAttribute("tabindex", "0");
                paymentButton.focus();
                return true;
            }
            let nextRow = row;
            let nextColumn = column;
            if (event.key === "ArrowLeft") nextColumn -= 1;
            if (event.key === "ArrowRight") nextColumn += 1;
            if (event.key === "ArrowUp") nextRow -= 1;
            if (event.key === "ArrowDown") nextRow += 1;
            if (
                nextRow < 0 || nextRow > 3 ||
                nextColumn < 0 || nextColumn > 3
            ) {
                return false;
            }

            const next = buttons[nextRow * 4 + nextColumn];
            if (!next || next.disabled) return false;
            next.setAttribute("tabindex", "0");
            next.focus();
            next.scrollIntoView({ block: "nearest", inline: "nearest" });
            return true;
        };
        this.ffNavigatePadControls = (event) => {
            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const current = active?.closest(".pads .control-buttons button");
            if (!current) return false;
            const controls = visibleElements(".pads .control-buttons button").sort(
                (left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left
            );
            const currentIndex = controls.indexOf(current);
            if (currentIndex < 0) return false;
            const direction = event.key === "ArrowLeft" ? -1 : 1;
            const next = controls[currentIndex + direction];
            if (!next) return false;
            next.setAttribute("tabindex", "0");
            next.focus();
            return true;
        };
        this.ffNavigateSpatially = (event) => {
            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            if (isEditableElement(active)) return false;
            const activeProduct = active?.closest(".product");
            const candidates = [...new Set(visibleElements(NAVIGABLE_SELECTOR))]
                .filter((element) => element.closest(".pos") && !element.closest(".o_dialog, .modal-dialog"))
                .filter((element) => !activeProduct || !element.matches(".product"));
            const next = findSpatialNeighbor(candidates, active, event.key, document.querySelector(".pos"));
            return focusNavigableElement(next);
        };
        this.ffFeedbackButtons = () => visibleElements(".feedback-screen button");
        this.ffNavigateFeedback = (event) => {
            if (!document.querySelector(".feedback-screen")) return false;
            const buttons = this.ffFeedbackButtons();
            if (!buttons.length) return false;
            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const activeButton = active?.closest(".feedback-screen button");
            if (!activeButton) {
                const first = buttons[0];
                first.setAttribute("tabindex", "0");
                first.focus();
                first.scrollIntoView({ block: "nearest", inline: "nearest" });
                return true;
            }
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                return false;
            }
            const activeRect = activeButton.getBoundingClientRect();
            const activeCenter = {
                x: activeRect.left + activeRect.width / 2,
                y: activeRect.top + activeRect.height / 2,
            };
            const direction = {
                ArrowLeft: { axis: "x", sign: -1 },
                ArrowRight: { axis: "x", sign: 1 },
                ArrowUp: { axis: "y", sign: -1 },
                ArrowDown: { axis: "y", sign: 1 },
            }[event.key];
            const ranked = buttons
                .filter((button) => button !== activeButton)
                .map((button) => {
                    const rect = button.getBoundingClientRect();
                    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    const primary = (center[direction.axis] - activeCenter[direction.axis]) * direction.sign;
                    if (primary <= 2) return null;
                    const secondaryAxis = direction.axis === "x" ? "y" : "x";
                    const secondary = Math.abs(center[secondaryAxis] - activeCenter[secondaryAxis]);
                    const aligned = direction.axis === "x"
                        ? rect.bottom > activeRect.top && rect.top < activeRect.bottom
                        : rect.right > activeRect.left && rect.left < activeRect.right;
                    return { button, aligned, score: primary + secondary * 0.35 };
                })
                .filter(Boolean)
                .sort((left, right) => left.score - right.score);
            const next = (ranked.find((candidate) => candidate.aligned) || ranked[0])?.button;
            if (!next) return false;
            next.setAttribute("tabindex", "0");
            next.focus();
            next.scrollIntoView({ block: "nearest", inline: "nearest" });
            return true;
        };
        this.ffNavigateShortcutHelp = (event) => {
            const dialog = document.querySelector(".ff-shortcut-help");
            if (!dialog) return false;
            if (event.key === "Escape") {
                const close = dialog.closest(".modal, .o_dialog")?.querySelector(
                    "button[aria-label='Close'], .btn-close"
                );
                if (close) {
                    close.click();
                    return true;
                }
                return false;
            }
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;
            const rows = visibleElements(".ff-shortcut-help tbody tr");
            if (!rows.length) return false;
            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const current = active?.closest(".ff-shortcut-help tbody tr");
            const index = current ? rows.indexOf(current) : -1;
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const next = rows[index < 0 ? (direction > 0 ? 0 : rows.length - 1) : index + direction];
            if (!next) return true;
            next.setAttribute("tabindex", "0");
            next.focus();
            next.scrollIntoView({ block: "nearest" });
            return true;
        };
        this.ffNavigateDialog = (event) => {
            const dialog = visibleElements(".modal.d-block, .o_dialog, .modal-dialog").at(-1);
            if (!dialog) return false;

            const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const candidates = [...new Set(visibleElements(NAVIGABLE_SELECTOR))]
                .filter((element) => dialog.contains(element) && !element.closest("[aria-hidden='true']"));
            const partnerList = dialog.matches(".partner-list")
                ? dialog
                : dialog.querySelector(".partner-list");
            const isPartnerSearch = Boolean(
                partnerList && active && partnerList.contains(active) && active.matches("input")
            );
            const isTextInput = active instanceof HTMLInputElement &&
                !["checkbox", "radio", "button", "submit", "reset"].includes(active.type);
            const autocompleteIsOpen = active?.getAttribute("aria-expanded") === "true";

            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                if (isEditableElement(active) && !isTextInput) return false;
                if (autocompleteIsOpen) return false;
                if (isPartnerSearch && ["ArrowUp", "ArrowDown"].includes(event.key)) {
                    const partners = visibleElements(".partner-info").filter(
                        (element) => partnerList.contains(element)
                    );
                    if (!partners.length) return false;
                    const current = active.closest(".partner-info");
                    const index = partners.indexOf(current);
                    if (index < 0 && event.key === "ArrowUp") return false;
                    const nextIndex = index < 0
                        ? 0
                        : Math.max(0, Math.min(
                            partners.length - 1,
                            index + (event.key === "ArrowDown" ? 1 : -1)
                        ));
                    return focusNavigableElement(partners[nextIndex]);
                }
                if (isTextInput && !["ArrowUp", "ArrowDown"].includes(event.key)) return false;
                const next = findSpatialNeighbor(candidates, active, event.key, dialog);
                return next ? focusNavigableElement(next) : candidates.length > 0;
            }

            if (event.key === "Enter") {
                if (isTextInput && !isPartnerSearch && !autocompleteIsOpen) {
                    const next = findSpatialNeighbor(candidates, active, "ArrowDown", dialog);
                    return next ? focusNavigableElement(next) : false;
                }
                const action = active?.closest(
                    "button:not([disabled]), [role='button']:not([aria-disabled='true']), a[href], .partner-info, .product, .orderline"
                );
                if (action && dialog.contains(action)) {
                    action.click();
                    return true;
                }
            }
            return false;
        };

        this.ffShortcutActions = {};
        const register = (command, action) => {
            this.ffShortcutActions[command] = action;
        };

        register("product_search", () => {
            if (!this.ffProductScreen()) return false;
            let input = visibleElement(".pos-rightheader input, input[placeholder*='Search products']");
            if (!input) {
                const searchButton = visibleElement(
                    ".pos-rightheader button:has(i[data-icon='search'])"
                );
                if (!searchButton) return false;
                searchButton.click();
                // The native POS button mounts the search field during the
                // following render cycle, so focus it after the click.
                window.setTimeout(() => {
                    const openedInput = visibleElement(
                        ".pos-rightheader input, input[placeholder*='Search products']"
                    );
                    openedInput?.focus();
                    openedInput?.select?.();
                }, 0);
            } else {
                input.focus();
                input.select?.();
            }
            return this.ffRun("product_search");
        });
        register("order_lines", () => {
            if (!this.ffProductScreen()) return false;
            const line = visibleElement(".orderline.selected, .orderline");
            if (!line) return false;
            if (!line.classList.contains("selected")) line.click();
            line.setAttribute("tabindex", "0");
            line.focus();
            return this.ffRun("order_lines");
        });
        register("numpad", () => {
            if (!this.ffProductScreen()) return false;
            const button = visibleElement(".pads .numpad-button") ||
                visibleElement(".pads .control-button") ||
                visibleElement(".pads .pay-order-button");
            if (!button) return false;
            button.setAttribute("tabindex", "0");
            button.focus();
            button.scrollIntoView({ block: "nearest", inline: "nearest" });
            return this.ffRun("numpad");
        });
        register("customer", () => {
            if (!this.ffProductScreen()) return false;
            this.pos.selectPartner();
            return this.ffRun("customer");
        });
        register("quantity", () => {
            if (!this.ffProductScreen()) return false;
            const button = visibleElement(".numpad-qty");
            if (!button) return false;
            button.click();
            return this.ffRun("quantity");
        });
        register("line_discount", () => {
            if (!this.ffProductScreen()) return false;
            const button = visibleElement(".numpad-discount");
            if (!button || button.disabled) return false;
            button.click();
            return this.ffRun("line_discount");
        });
        register("price", () => {
            if (!this.ffProductScreen()) return false;
            const button = visibleElement(".numpad-price");
            if (!button || button.disabled) return false;
            button.click();
            return this.ffRun("price");
        });
        register("payment", () => {
            if (this.ffPaymentScreen()) {
                return this.ffFocusPaymentControls() && this.ffRun("payment");
            }
            if (!this.ffProductScreen() || !this.pos.getOrder()) return false;
            this.pos.pay();
            window.setTimeout(() => this.ffFocusPaymentControls(), 0);
            return this.ffRun("payment");
        });
        register("new_order", () => {
            if (!this.ffNoDialog()) return false;
            const order = this.pos.addNewOrder();
            if (order) this.pos.navigateToOrderScreen(order);
            return this.ffRun("new_order");
        });
        register("orders", () => {
            if (this.ffPaymentScreen() && this.pos.getOrder()?.finalized) {
                this.pos.openFinalizedOrders();
            } else {
                this.pos.navigate("TicketScreen");
            }
            return this.ffRun("orders");
        });
        register("order_discount", () => {
            if (!this.ffProductScreen()) return false;
            const more = visibleElement(".more-btn");
            if (!more) return false;
            more.click();
            const discount = [...document.querySelectorAll(".control-buttons-modal button")].find((button) => {
                const text = (button.textContent || "").toLowerCase();
                return text.includes("discount") || text.includes("خصم");
            });
            discount?.click();
            return this.ffRun("order_discount");
        });
        register("help", () => {
            this.ffShortcuts.add(ShortcutHelpDialog, {
                bindings: this.ffShortcutBindings(),
            });
            return this.ffRun("help");
        });

        // Use a native document listener instead of a component-local hotkey
        // scope: Chrome is mounted before some POS screens and must receive
        // key events consistently across all native screens and browsers.
        this.ffHandleShortcut = (event) => {
            if (!this.ffShortcutEnabled() || !this.ffIsActivePos() || !this.ffNoDialog() || event.isComposing) {
                return;
            }
            const activeHotkey = normalizeShortcutEvent(event);
            const bindings = this.ffShortcutBindings();
            const macBindings = Object.fromEntries(
                Object.entries(bindings).map(([name, binding]) => [name, MAC_SHORTCUTS[name] || toMacShortcut(binding)])
            );
            const command = Object.keys(bindings).find(
                (name) => bindings[name] === activeHotkey ||
                    (event.altKey && !event.ctrlKey && !event.metaKey && macBindings[name] === activeHotkey) ||
                    (activeHotkey === "control+shift+?" && bindings[name] === "control+shift+?")
            );
            if (!command || !this.ffShortcutActions[command]) {
                return;
            }
            const isEditable =
                event.target instanceof HTMLElement &&
                (/input|textarea/i.test(event.target.tagName) || event.target.isContentEditable);
            if (isEditable) {
                return;
            }
            if (this.ffShortcutActions[command](event) !== false) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        document.addEventListener("keydown", this.ffHandleShortcut, true);
        this.ffHandleListNavigation = (event) => {
            if (
                event.isComposing ||
                document.visibilityState !== "visible" ||
                !document.querySelector(".pos")
            ) {
                return;
            }
            if (this.ffNavigateFeedback(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (this.ffNavigateShortcutHelp(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (this.ffNavigateDialog(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (visibleElements(".modal.d-block, .o_dialog, .modal-dialog").length) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                if (
                    this.ffNavigateNumpad(event) ||
                    this.ffNavigateActiveList(event) ||
                    this.ffNavigateProductGrid(event) ||
                    this.ffNavigateSpatially(event)
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                if (
                    this.ffNavigatePadControls(event) ||
                    this.ffNavigateNumpad(event) ||
                    this.ffNavigateProductGrid(event) ||
                    this.ffNavigateSpatially(event)
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            } else if (event.key === "Enter") {
                const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                const isEditable = isEditableElement(active);
                const action = active?.closest(
                    "button:not([disabled]), [role='button']:not([aria-disabled='true']), a[href], .orderline, .product, .partner-info"
                );
                const isActivatable = action && document.querySelector(".pos")?.contains(action);
                if (active && !isEditable && isActivatable) {
                    action.click();
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        };
        document.addEventListener("keydown", this.ffHandleListNavigation, true);
        onWillUnmount(() => {
            document.removeEventListener("keydown", this.ffHandleShortcut, true);
            document.removeEventListener("keydown", this.ffHandleListNavigation, true);
        });
    },
});

export { DEFAULT_SHORTCUTS, LABELS, readBindings };
