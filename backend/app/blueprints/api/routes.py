from flask import Blueprint, jsonify, request

api = Blueprint("api", __name__)

@api.get("/health")
def health():
    return jsonify(status="ok")

