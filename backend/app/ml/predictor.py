import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "severity_model.joblib"

class DisasterPredictor:
    def __init__(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"ML Model not found at {MODEL_PATH}. Please run train.py first.")
        self.model = joblib.load(MODEL_PATH)
        self.classes = list(self.model.classes_)
        # Severity weights for continuous risk score calculation
        self.class_weights = {
            "Low": 15.0,
            "Medium": 45.0,
            "High": 75.0,
            "Critical": 100.0
        }

    def predict(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs ML inference on disaster features and generates explainability metrics.
        """
        df = pd.DataFrame([{
            "disaster_type": incident_data.get("disaster_type", "Flood"),
            "weather_condition": incident_data.get("weather_condition", "Normal"),
            "casualties": int(incident_data.get("casualties", 0)),
            "affected_population": int(incident_data.get("affected_population", 0)),
            "damage_level": int(incident_data.get("damage_level", 1))
        }])

        # Probability distribution across Low, Medium, High, Critical
        probs = self.model.predict_proba(df)[0]
        prob_dict = {cls_name: round(float(prob), 4) for cls_name, prob in zip(self.classes, probs)}
        
        # Predicted class (highest probability)
        predicted_class = self.classes[np.argmax(probs)]
        
        # Calculate continuous Risk Score (0 - 100)
        risk_score = sum(prob_dict.get(cls, 0.0) * self.class_weights.get(cls, 0.0) for cls in self.classes)
        risk_score = round(float(np.clip(risk_score, 0.0, 100.0)), 1)
        
        # Explainable AI (XAI) feature factor heuristics
        casualties = df["casualties"].iloc[0]
        damage = df["damage_level"].iloc[0]
        population = df["affected_population"].iloc[0]
        disaster_type = df["disaster_type"].iloc[0]
        
        # Approximate feature contribution breakdown
        cas_factor = min(45.0, (casualties / 30.0) * 45.0)
        dmg_factor = (damage / 5.0) * 30.0
        pop_factor = min(20.0, (population / 15000.0) * 20.0)
        type_factor = 10.0 if disaster_type in ["Earthquake", "Cyclone", "Flood"] else 5.0
        
        total_factors = cas_factor + dmg_factor + pop_factor + type_factor
        if total_factors > 0:
            feature_contributions = {
                "Casualties Impact": round((cas_factor / total_factors) * 100, 1),
                "Infrastructure Damage": round((dmg_factor / total_factors) * 100, 1),
                "Affected Population": round((pop_factor / total_factors) * 100, 1),
                "Hazard Type & Weather": round((type_factor / total_factors) * 100, 1)
            }
        else:
            feature_contributions = {
                "Casualties Impact": 25.0,
                "Infrastructure Damage": 25.0,
                "Affected Population": 25.0,
                "Hazard Type & Weather": 25.0
            }

        # Human-readable explanation text
        explanation_parts = [
            f"Random Forest ML classified as {predicted_class} severity (Risk Score: {risk_score}/100)."
        ]
        if casualties > 10:
            explanation_parts.append(f"High reported casualties ({casualties}) is the primary risk driver.")
        elif casualties > 0:
            explanation_parts.append(f"Casualties ({casualties}) factored into priority score.")
        
        if damage >= 4:
            explanation_parts.append(f"Severe infrastructure destruction (Level {damage}/5) necessitates heavy rescue gear.")
        
        if population > 5000:
            explanation_parts.append(f"Substantial population exposure ({population:,} individuals) increases triage urgency.")

        explanation = " ".join(explanation_parts)

        return {
            "severity_level": predicted_class,
            "risk_score": risk_score,
            "confidence": round(float(np.max(probs)), 2),
            "class_probabilities": prob_dict,
            "feature_contributions": feature_contributions,
            "explanation": explanation,
            "is_simulated_model": False
        }

# Singleton instance
predictor = DisasterPredictor()
