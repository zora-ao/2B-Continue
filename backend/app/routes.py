from flask import Blueprint, jsonify, request

api = Blueprint("api", __name__)

# In-memory store so the boilerplate works without a database.
_items: list[dict] = [{"id": 1, "text": "Hello from Flask"}]


@api.get("/health")
def health():
    return jsonify(status="ok")


@api.get("/items")
def list_items():
    return jsonify(_items)


@api.post("/items")
def create_item():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify(error="'text' is required"), 400
    item = {"id": max((i["id"] for i in _items), default=0) + 1, "text": text}
    _items.append(item)
    return jsonify(item), 201
