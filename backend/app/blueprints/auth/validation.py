from ...errors import ValidationError


def check_keys(data, allowed):
    if set(data) != allowed:
        raise ValidationError("Send exactly these fields: " + ", ".join(sorted(allowed)) + ".")


def normalize_email(value):
    if not isinstance(value, str) or "\x00" in value:
        raise ValidationError("Enter a valid email address.")
    email = value.strip().lower()
    local, at, domain = email.partition("@")
    if (len(email) > 254 or not at or not local or "@" in domain
            or "." not in domain.strip(".") or domain.startswith(".") or domain.endswith(".")):
        raise ValidationError("Enter a valid email address.")
    return email


def check_password(value):
    if not isinstance(value, str) or not 8 <= len(value) <= 128:
        raise ValidationError("Password must contain 8-128 characters.")
    return value


def validate_registration(data):
    check_keys(data, {"name", "email", "password"})
    name = data["name"]
    if not isinstance(name, str) or "\x00" in name or not 1 <= len(name.strip()) <= 120:
        raise ValidationError("Name must contain 1-120 characters.")
    return {"name": name.strip(), "email": normalize_email(data["email"]),
            "password": check_password(data["password"])}


def validate_login(data):
    check_keys(data, {"email", "password"})
    email, password = data["email"], data["password"]
    if not isinstance(email, str) or not isinstance(password, str) or len(password) > 128:
        raise ValidationError("Send an email and a password.")
    return email, password
