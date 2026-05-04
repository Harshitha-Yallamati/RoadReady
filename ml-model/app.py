import os
import joblib
import numpy as np
from flask import Flask, jsonify, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")

app = Flask(__name__)

model = None
model_load_error = None

DAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def load_model_once():
    global model, model_load_error

    if model is not None or model_load_error is not None:
        return model

    if not os.path.exists(MODEL_PATH):
        model_load_error = "model.pkl not found in ml-model folder."
        return None

    try:
        model = joblib.load(MODEL_PATH)
        return model
    except Exception as exc:
        model_load_error = f"Unable to load model.pkl: {exc}"
        return None


def parse_time_to_hour(value):
    # Accept hour as number or HH:MM string
    if isinstance(value, (int, float)):
        hour = int(value)
    elif isinstance(value, str):
        val = value.strip()
        if ":" in val:
            parts = val.split(":")
            hour = int(parts[0])
        else:
            hour = int(float(val))
    else:
        raise ValueError("Invalid time")

    if hour < 0 or hour > 23:
        raise ValueError("Time must be between 0 and 23")
    return hour


def parse_day_to_index(value):
    # Accept day index (0-6) or day name
    if isinstance(value, (int, float)):
        day_idx = int(value)
    elif isinstance(value, str):
        val = value.strip().lower()
        if val.isdigit():
            day_idx = int(val)
        elif val in DAY_MAP:
            day_idx = DAY_MAP[val]
        else:
            raise ValueError("Invalid day name")
    else:
        raise ValueError("Invalid day")

    if day_idx < 0 or day_idx > 6:
        raise ValueError("Day must be between 0 and 6")
    return day_idx


def baseline_traffic_score(hour, day_idx):
    # Simple baseline for feature mapping and fallback
    peak = 25 if hour in (8, 9, 17, 18, 19) else 0
    shoulder = 10 if hour in (7, 10, 16, 20) else 0
    weekend_delta = -8 if day_idx >= 5 else 8
    score = 40 + peak + shoulder + weekend_delta
    return float(max(0, min(100, score)))


def build_features_for_model(model_obj, hour, day_idx):
    n_features = int(getattr(model_obj, "n_features_in_", 2) or 2)

    # Preferred expected model for this API: [time, day]
    if n_features == 2:
        return [float(hour), float(day_idx)]

    # Backward compatibility for old 4-feature model:
    # [distance, time, cost, traffic]
    if n_features == 4:
        traffic = baseline_traffic_score(hour, day_idx)
        distance = 12.0
        travel_time = max(5.0, 20.0 + (traffic * 0.5))
        cost = round(distance * 6.5, 2)
        return [distance, travel_time, cost, traffic]

    # Generic fallback: pad remaining features with baseline traffic
    vector = [0.0] * n_features
    vector[0] = float(hour)
    if n_features > 1:
        vector[1] = float(day_idx)
    for idx in range(2, n_features):
        vector[idx] = baseline_traffic_score(hour, day_idx)
    return vector


def normalize_score(value):
    # Keep score in a predictable 0-100 range for API consumers
    if value <= 1:
        value *= 100.0
    return float(max(0, min(100, value)))


def score_to_level(score):
    if score < 34:
        return "LOW"
    if score < 67:
        return "MEDIUM"
    return "HIGH"


@app.get("/")
def home():
    return jsonify(
        {
            "status": "ok",
            "service": "AI Smart Router Planner ML API",
            "health": "/health",
            "predict": "/predict",
        }
    )


@app.get("/health")
def health():
    load_model_once()
    return jsonify(
        {
            "status": "ok",
            "modelLoaded": model is not None,
            "error": model_load_error,
        }
    )


@app.post("/predict")
def predict():
    model_obj = load_model_once()
    if model_obj is None:
        return jsonify({"error": model_load_error or "Model unavailable"}), 503

    payload = request.get_json(silent=True) or {}

    try:
        hour = parse_time_to_hour(payload.get("time"))
        day_idx = parse_day_to_index(payload.get("day"))
    except ValueError as exc:
        return jsonify({"error": str(exc), "expected": {"time": "HH:MM or 0-23", "day": "0-6 or day name"}}), 400

    try:
        features = build_features_for_model(model_obj, hour, day_idx)
        prediction = float(model_obj.predict(np.array([features], dtype=np.float32))[0])
        score = round(normalize_score(prediction), 2)
    except Exception as exc:
        return jsonify({"error": f"Prediction failed: {exc}"}), 500

    return jsonify({"level": score_to_level(score), "score": score})


# Load once at startup so repeated requests do not reload from disk
load_model_once()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
