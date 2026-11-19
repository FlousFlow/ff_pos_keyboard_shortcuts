import json

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


DEFAULT_SHORTCUTS = {
    "new_order": "shift+n",
    "product_search": "shift+f",
    "order_lines": "shift+l",
    "customer": "shift+c",
    "numpad": "shift+k",
    "quantity": "shift+q",
    "line_discount": "shift+d",
    "order_discount": "shift+o",
    "price": "shift+p",
    "payment": "shift+e",
    "orders": "shift+h",
    "help": "shift+j",
}


class PosConfig(models.Model):
    _inherit = "pos.config"

    ff_keyboard_shortcuts_enabled = fields.Boolean(
        string="تفعيل اختصارات لوحة المفاتيح",
        compute="_compute_ff_keyboard_shortcut_settings",
        readonly=True,
        help="يتم التحكم بهذا الإعداد من الإعدادات العامة ويطبق على كل نقاط البيع.",
    )
    ff_keyboard_shortcuts_show_hints = fields.Boolean(
        string="إظهار تلميحات الاختصارات",
        compute="_compute_ff_keyboard_shortcut_settings",
        readonly=True,
        help="يتم التحكم بهذا الإعداد من الإعدادات العامة.",
    )
    ff_keyboard_shortcut_bindings = fields.Text(
        string="تخصيص الاختصارات",
        compute="_compute_ff_keyboard_shortcut_settings",
        readonly=True,
        help="كائن JSON يربط أسماء الأوامر باختصارات Odoo.",
    )

    def _compute_ff_keyboard_shortcut_settings(self):
        parameters = self.env["ir.config_parameter"].sudo()
        enabled = parameters.get_bool("ff_pos_keyboard_shortcuts.enabled", False)
        show_hints = parameters.get_bool("ff_pos_keyboard_shortcuts.show_hints", True)
        bindings = parameters.get_str(
            "ff_pos_keyboard_shortcuts.bindings",
            json.dumps(DEFAULT_SHORTCUTS, sort_keys=True),
        )
        for config in self:
            config.ff_keyboard_shortcuts_enabled = enabled
            config.ff_keyboard_shortcuts_show_hints = show_hints
            config.ff_keyboard_shortcut_bindings = bindings

    @api.model
    def _load_pos_data_fields(self, config):
        # Odoo 20's base ``pos.config`` inherits ``pos.load.mixin`` but does
        # not provide a concrete field list.  Returning only addon fields
        # makes the core ``_load_pos_data_read`` post-processing miss fields
        # such as ``use_pricelist``.  Build the safe stored-field baseline
        # dynamically so installed POS extensions remain compatible.
        fields_to_load = [
            name for name, field in self._fields.items()
            if field.store and not field.manual and field.type != "one2many"
        ]
        fields_to_load += [
            "ff_keyboard_shortcuts_enabled",
            "ff_keyboard_shortcuts_show_hints",
            "ff_keyboard_shortcut_bindings",
        ]
        return list(dict.fromkeys(fields_to_load))

    @api.model
    def _validate_ff_keyboard_shortcut_bindings(self, value):
        allowed_commands = set(DEFAULT_SHORTCUTS)
        try:
            bindings = json.loads(value or "{}")
        except (TypeError, ValueError) as error:
            raise ValidationError(_("Keyboard shortcut bindings must be valid JSON.")) from error
        if not isinstance(bindings, dict):
            raise ValidationError(_("Keyboard shortcut bindings must be a JSON object."))
        unknown = set(bindings) - allowed_commands
        if unknown:
            raise ValidationError(_("Unknown keyboard shortcut command(s): %s") % ", ".join(sorted(unknown)))
        values = [item.strip().lower() for item in bindings.values() if isinstance(item, str) and item.strip()]
        if len(values) != len(set(values)):
            raise ValidationError(_("Each keyboard shortcut must be unique."))
        return bindings
