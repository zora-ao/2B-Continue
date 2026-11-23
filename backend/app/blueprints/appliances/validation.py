from decimal import Decimal, InvalidOperation

from ...errors import ValidationError


def validate_appliance(data, *, partial=False):
    if not isinstance(data, dict):
        raise ValidationError("Send a JSON object.")
    allowed = {"name", "appliance_type", "room", "watts", "quantity",
               "hours_per_day", "is_must_have"}
    unknown = set(data) - allowed
    if unknown:
        raise ValidationError("Unknown fields: " + ", ".join(sorted(unknown)))
    if not partial and not {"name", "watts", "hours_per_day"} <= data.keys():
        raise ValidationError("name, watts, and hours_per_day are required.")
    if partial and not data:
        raise ValidationError("Provide at least one field to update.")
    values = {}
    for field, limit in (("name", 120), ("appliance_type", 80), ("room", 120)):
        if field not in data:
            continue
        value = data[field]
        if value is None and field != "name":
            values[field] = None
            continue
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
            raise ValidationError(f"{field} must contain 1–{limit} characters.")
        values[field] = value.strip()
    for field, maximum in (("watts", Decimal("999999999.999")),
                           ("hours_per_day", Decimal(24))):
        if field not in data:
            continue
        try:
            value = Decimal(str(data[field]))
        except (InvalidOperation, ValueError):
            raise ValidationError(f"{field} must be a number.") from None
        if not value.is_finite() or value < 0 or value > maximum or (field == "watts" and value == 0):
            raise ValidationError(f"{field} is outside the allowed range.")
        if value.as_tuple().exponent < -3 and value != value.quantize(Decimal("0.001")):
            raise ValidationError(f"{field} supports up to 3 decimal places.")
        values[field] = value
    if "quantity" in data:
        value = data["quantity"]
        if type(value) is not int or not 1 <= value <= 2147483647:
            raise ValidationError("quantity must be a positive integer up to 2147483647.")
        values["quantity"] = value
    if "is_must_have" in data:
        if type(data["is_must_have"]) is not bool:
            raise ValidationError("is_must_have must be true or false.")
        values["is_must_have"] = data["is_must_have"]
    return values


