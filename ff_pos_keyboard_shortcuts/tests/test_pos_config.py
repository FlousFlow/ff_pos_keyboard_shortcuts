import json

from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase


class TestPosKeyboardShortcuts(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.config = cls.env["pos.config"].create({"name": "Keyboard shortcuts test"})

    def test_defaults_are_loaded_for_pos(self):
        self.env["ir.config_parameter"].sudo().set_bool("ff_pos_keyboard_shortcuts.enabled", False)
        fields_to_load = self.env["pos.config"]._load_pos_data_fields(self.config)
        self.assertIn("ff_keyboard_shortcuts_enabled", fields_to_load)
        self.assertIn("ff_keyboard_shortcut_bindings", fields_to_load)
        self.assertEqual(
            json.loads(self.config.ff_keyboard_shortcut_bindings)["product_search"],
            "shift+f",
        )
        self.assertFalse(self.config.ff_keyboard_shortcuts_enabled)

    def test_cash_control_is_loaded_for_pos(self):
        fields_to_load = self.env["pos.config"]._load_pos_data_fields(self.config)
        self.assertIn("cash_control", fields_to_load)
        loaded_config = self.config.read(fields_to_load, load=False)[0]
        self.assertEqual(loaded_config["cash_control"], self.config.cash_control)

    def test_duplicate_bindings_are_rejected(self):
        with self.assertRaises(ValidationError):
            self.env["res.config.settings"].create({
                "ff_keyboard_shortcut_bindings": json.dumps({"product_search": "f2", "customer": "f2"}),
            })

    def test_global_settings_apply_to_all_pos(self):
        settings = self.env["res.config.settings"].create({
            "ff_keyboard_shortcuts_enabled": True,
            "ff_keyboard_shortcut_bindings": json.dumps({"product_search": "f12"}),
        })
        settings.execute()
        self.assertTrue(self.config.ff_keyboard_shortcuts_enabled)
        self.assertEqual(json.loads(self.config.ff_keyboard_shortcut_bindings)["product_search"], "f12")
