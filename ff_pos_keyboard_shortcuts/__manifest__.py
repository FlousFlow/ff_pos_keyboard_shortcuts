{
    "name": "POS Keyboard Shortcuts",
    "version": "20.0.1.0.5",
    "category": "Sales/Point of Sale",
    "summary": "Keyboard-first navigation for Odoo Point of Sale",
    "description": """
POS Keyboard Shortcuts
======================
Native keyboard-first navigation for Odoo 20 Point of Sale. The addon adds
configurable Windows/Linux and MacBook shortcuts, spatial arrow navigation,
customer and payment-screen navigation, and a scrollable shortcut reference.
Actions are delegated to standard POS screens and stores, preserving barcode,
offline, payment, and access-rights behavior.
    """,
    "author": "Flous Flow",
    "support": "support@flousflow.com",
    "website": "https://flousflow.com",
    "license": "LGPL-3",
    "images": [
        "static/description/images/cover.png",
        "static/description/images/feature-overview.png",
        "static/description/images/screenshot-shortcuts.png",
        "static/description/images/screenshot-payment.png",
    ],
    "depends": ["point_of_sale"],
    "data": ["views/res_config_settings_views.xml"],
    "assets": {
        "web.assets_backend": [
            "ff_pos_keyboard_shortcuts/static/src/css/keyboard_shortcuts.scss",
        ],
        "point_of_sale._assets_pos": [
            "ff_pos_keyboard_shortcuts/static/src/css/keyboard_shortcuts.scss",
            "ff_pos_keyboard_shortcuts/static/src/app/keyboard_shortcuts.js",
            "ff_pos_keyboard_shortcuts/static/src/app/keyboard_shortcuts.xml",
        ],
    },
    "installable": True,
    "application": False,
}
