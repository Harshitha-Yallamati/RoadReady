import os
import numpy as np
import tensorflow as tf


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "traffic_model.h5")


def create_synthetic_data(samples=1000, seed=42):
    rng = np.random.default_rng(seed)
    hours = rng.integers(0, 24, size=samples)
    days = rng.integers(0, 7, size=samples)

    hour_component = 35 + 25 * np.sin((hours / 24) * 2 * np.pi)
    day_component = np.where(days >= 5, -8, 12)  # lighter traffic on weekends
    noise = rng.normal(0, 4, size=samples)
    traffic = np.clip(hour_component + day_component + noise, 5, 100)

    x = np.column_stack((hours / 23.0, days / 6.0)).astype(np.float32)
    y = (traffic / 100.0).astype(np.float32)

    # LSTM expects shape: (batch, timesteps, features)
    x = x.reshape((x.shape[0], 1, x.shape[1]))
    return x, y


def train_and_save_lstm():
    x, y = create_synthetic_data()

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(1, 2)),
            tf.keras.layers.LSTM(16, activation="tanh"),
            tf.keras.layers.Dense(8, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )

    model.compile(optimizer="adam", loss="mse")
    model.fit(x, y, epochs=20, batch_size=32, verbose=0)
    model.save(MODEL_PATH)
    print(f"LSTM traffic model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    train_and_save_lstm()
