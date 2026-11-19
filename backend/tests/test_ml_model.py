import pytest
from app.ml.predictor import DisasterPredictor

@pytest.fixture
def predictor_instance():
    return DisasterPredictor()

def test_critical_disaster_prediction(predictor_instance):
    """Verifies that high casualties and catastrophic damage trigger High or Critical severity."""
    severe_data = {
        "disaster_type": "Flood",
        "weather_condition": "Severe Rain",
        "casualties": 45,
        "affected_population": 12000,
        "damage_level": 5
    }
    result = predictor_instance.predict(severe_data)
    assert result["severity_level"] in ["Critical", "High"]
    assert 70.0 <= result["risk_score"] <= 100.0
    assert result["confidence"] > 0.4
    assert "casualties" in result["explanation"].lower()

def test_minor_incident_prediction(predictor_instance):
    """Verifies that zero casualties and low damage trigger Low or Medium severity."""
    minor_data = {
        "disaster_type": "Flood",
        "weather_condition": "Moderate Rain",
        "casualties": 0,
        "affected_population": 150,
        "damage_level": 1
    }
    result = predictor_instance.predict(minor_data)
    assert result["severity_level"] in ["Low", "Medium"]
    assert result["risk_score"] < 65.0

def test_risk_score_bounds_and_explainability(predictor_instance):
    """Tests that continuous risk score is within [0, 100] and feature contributions sum to 100%."""
    sample_data = {
        "disaster_type": "Cyclone",
        "weather_condition": "Storm Winds",
        "casualties": 10,
        "affected_population": 3000,
        "damage_level": 3
    }
    result = predictor_instance.predict(sample_data)
    assert 0.0 <= result["risk_score"] <= 100.0
    contributions = result["feature_contributions"]
    assert "Casualties Impact" in contributions
    assert "Infrastructure Damage" in contributions
    total_contrib = sum(contributions.values())
    assert 99.0 <= total_contrib <= 101.0
