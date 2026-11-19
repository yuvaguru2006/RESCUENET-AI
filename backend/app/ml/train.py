import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib
from pathlib import Path

# Paths
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = ARTIFACTS_DIR / "severity_model.joblib"

DISASTER_TYPES = ["Flood", "Cyclone", "Earthquake", "Wildfire", "Landslide", "Building Collapse"]
WEATHER_CONDITIONS = ["Normal", "Moderate Rain", "Severe Rain", "Storm Winds", "Dry/High Wind", "Monsoon Surge"]

def generate_synthetic_disaster_dataset(n_samples: int = 4000, random_state: int = 42) -> pd.DataFrame:
    """
    Generates a realistic calibrated synthetic dataset for disaster severity classification.
    Explicitly labelled as SIMULATED data for academic research/demonstration.
    """
    np.random.seed(random_state)
    
    disaster_type = np.random.choice(DISASTER_TYPES, size=n_samples, p=[0.30, 0.25, 0.15, 0.10, 0.10, 0.10])
    weather = np.random.choice(WEATHER_CONDITIONS, size=n_samples, p=[0.15, 0.25, 0.25, 0.15, 0.10, 0.10])
    
    # Casualties: heavy-tailed Poisson/exponential
    casualties_raw = np.random.exponential(scale=12.0, size=n_samples)
    casualties = np.clip(np.round(casualties_raw), 0, 300).astype(int)
    
    # Affected population: log-normal distribution
    affected_pop_raw = np.random.lognormal(mean=7.5, sigma=1.2, size=n_samples)
    affected_population = np.clip(np.round(affected_pop_raw), 50, 75000).astype(int)
    
    # Damage Level: 1 to 5
    damage_level = np.random.choice([1, 2, 3, 4, 5], size=n_samples, p=[0.15, 0.25, 0.30, 0.20, 0.10])
    
    # Compute ground truth composite risk points according to civil defense heuristics
    points = np.zeros(n_samples)
    
    # Casualties contribution
    points += np.where(casualties == 0, 2, 0)
    points += np.where((casualties >= 1) & (casualties <= 4), 18, 0)
    points += np.where((casualties >= 5) & (casualties <= 15), 45, 0)
    points += np.where((casualties >= 16) & (casualties <= 40), 75, 0)
    points += np.where(casualties > 40, 110, 0)
    
    # Damage contribution
    damage_weights = {1: 5, 2: 15, 3: 35, 4: 60, 5: 90}
    points += np.vectorize(damage_weights.get)(damage_level)
    
    # Population contribution
    points += np.where(affected_population < 500, 5, 0)
    points += np.where((affected_population >= 500) & (affected_population < 2500), 18, 0)
    points += np.where((affected_population >= 2500) & (affected_population < 10000), 38, 0)
    points += np.where(affected_population >= 10000, 65, 0)
    
    # Hazard type multipliers
    for i in range(n_samples):
        if disaster_type[i] in ["Earthquake", "Building Collapse"] and damage_level[i] >= 4:
            points[i] += 25
        elif disaster_type[i] in ["Flood", "Cyclone"] and weather[i] in ["Severe Rain", "Monsoon Surge"]:
            points[i] += 20
        elif disaster_type[i] == "Wildfire" and weather[i] == "Dry/High Wind":
            points[i] += 20

    # Add realistic observation noise (sigma = 6)
    noise = np.random.normal(0, 6, size=n_samples)
    points = np.clip(points + noise, 0, 300)
    
    # Map composite points to standardized 4-class triage severity
    severity_labels = []
    for p in points:
        if p < 50:
            severity_labels.append("Low")
        elif p < 95:
            severity_labels.append("Medium")
        elif p < 155:
            severity_labels.append("High")
        else:
            severity_labels.append("Critical")
            
    df = pd.DataFrame({
        "disaster_type": disaster_type,
        "weather_condition": weather,
        "casualties": casualties,
        "affected_population": affected_population,
        "damage_level": damage_level,
        "severity_level": severity_labels,
        "is_simulated": True
    })
    
    return df

def train_and_export_model():
    """Trains a Random Forest classifier pipeline and saves it with joblib."""
    print("Generating simulated disaster training data...")
    df = generate_synthetic_disaster_dataset(n_samples=5000, random_state=42)
    
    X = df[["disaster_type", "weather_condition", "casualties", "affected_population", "damage_level"]]
    y = df["severity_level"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    num_cols = ["casualties", "affected_population", "damage_level"]
    cat_cols = ["disaster_type", "weather_condition"]
    
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols)
        ]
    )
    
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42, n_jobs=-1))
        ]
    )
    
    print("Training Random Forest Classifier on disaster scenarios...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Model Training Complete! Test Accuracy: {acc:.4f}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    
    # Persist artifact
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model saved successfully to: {MODEL_PATH}")
    return pipeline

if __name__ == "__main__":
    train_and_export_model()
