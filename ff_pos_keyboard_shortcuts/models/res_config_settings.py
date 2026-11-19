import json

from odoo import api, fields, models

from .pos_config import DEFAULT_SHORTCUTS


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    ff_keyboard_shortcuts_enabled = fields.Boolean(
        string="تفعيل اختصارات لوحة المفاتيح",
        config_parameter="ff_pos_keyboard_shortcuts.enabled",
        default=False,
    )
    ff_keyboard_shortcuts_show_hints = fields.Boolean(
        string="إظهار تلميحات الاختصارات",
        config_parameter="ff_pos_keyboard_shortcuts.show_hints",
        default=True,
    )
    ff_keyboard_shortcut_bindings = fields.Char(
        string="تخصيص الاختصارات",
        config_parameter="ff_pos_keyboard_shortcuts.bindings",
        default=lambda self: json.dumps(DEFAULT_SHORTCUTS, sort_keys=True),
    )

    @api.constrains("ff_keyboard_shortcut_bindings")
    def _check_ff_keyboard_shortcut_bindings(self):
        for settings in self:
            self.env["pos.config"]._validate_ff_keyboard_shortcut_bindings(
                settings.ff_keyboard_shortcut_bindings
            )

    def action_ff_restore_keyboard_shortcut_defaults(self):
        self.ensure_one()
        self.ff_keyboard_shortcut_bindings = json.dumps(DEFAULT_SHORTCUTS, sort_keys=True)
        return True
