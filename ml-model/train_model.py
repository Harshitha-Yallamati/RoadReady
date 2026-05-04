import os
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")


def train_and_save_model():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError("dataset.csv not found in ml-model folder.")

    data = pd.read_csv(DATASET_PATH)
    required_columns = ["distance", "time", "cost", "traffic", "score"]
    missing_columns = [column for column in required_columns if column not in data.columns]
    if missing_columns:
        raise ValueError(f"Missing columns in dataset.csv: {missing_columns}")

    x = data[["distance", "time", "cost", "traffic"]]
    y = data["score"]

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
    )
    model.fit(x, y)

    joblib.dump(model, MODEL_PATH)
    print(f"RandomForest model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    train_and_save_model()
