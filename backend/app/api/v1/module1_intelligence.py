from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Optional
from app.core.database import get_db, get_db_context
from app.schemas.pydantic_schemas import (
    IncidentCreate,
    IncidentResponse,
    IncidentPredictionRequest,
    IncidentPredictionResponse
)
from app.ml.predictor import predictor

router = APIRouter(prefix="/incidents", tags=["Module 1: Disaster Intelligence & Severity Prediction"])

@router.post("/register", response_model=IncidentResponse, status_code=201)
def register_incident(payload: IncidentCreate, conn: sqlite3.Connection = Depends(get_db)):
    """
    Registers a new disaster incident, triggers ML-based severity classification and risk analysis,
    stores incident data in SQLite, and generates an emergency alert if severity is High or Critical.
    """
    # 1. Run genuine ML model prediction
    ml_input = payload.model_dump()
    ml_output = predictor.predict(ml_input)
    
    severity = ml_output["severity_level"]
    risk_score = ml_output["risk_score"]
    explanation = ml_output["explanation"]
    
    cursor = conn.cursor()
    # Check if an active incident with the same title already exists (deduplication)
    cursor.execute(
        "SELECT id, severity_level FROM incidents WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND status = 'Active';",
        (payload.title,)
    )
    existing = cursor.fetchone()

    if existing:
        incident_id = existing["id"]
        # Update existing incident telemetry rather than creating duplicate records
        cursor.execute("""
        UPDATE incidents SET
            disaster_type = ?, latitude = ?, longitude = ?, location_name = ?,
            casualties = ?, affected_population = ?, damage_level = ?, weather_condition = ?,
            severity_level = ?, risk_score = ?, prediction_explanation = ?
        WHERE id = ?;
        """, (
            payload.disaster_type, payload.latitude, payload.longitude,
            payload.location_name, payload.casualties, payload.affected_population,
            payload.damage_level, payload.weather_condition, severity, risk_score, explanation,
            incident_id
        ))
        conn.commit()

        # Update or sync existing active alert
        if severity in ["Critical", "High"]:
            cursor.execute("SELECT id FROM emergency_alerts WHERE incident_id = ? AND is_active = 1;", (incident_id,))
            alert_row = cursor.fetchone()
            if alert_row:
                cursor.execute("""
                UPDATE emergency_alerts SET
                    alert_level = ?, headline = ?, message = ?
                WHERE id = ?;
                """, (
                    severity,
                    f"URGENT: {severity.upper()} SEVERITY INCIDENT - {payload.title}",
                    f"{payload.location_name}: {severity} event detected by AI intelligence. Casualties: {payload.casualties}, Population: {payload.affected_population:,}. Risk Index: {risk_score}/100. Dispatch review required.",
                    alert_row["id"]
                ))
            else:
                cursor.execute("""
                INSERT INTO emergency_alerts (
                    incident_id, alert_level, headline, message, is_active
                ) VALUES (?, ?, ?, ?, 1);
                """, (
                    incident_id,
                    severity,
                    f"URGENT: {severity.upper()} SEVERITY INCIDENT - {payload.title}",
                    f"{payload.location_name}: {severity} event detected by AI intelligence. Casualties: {payload.casualties}, Population: {payload.affected_population:,}. Risk Index: {risk_score}/100. Dispatch review required."
                ))
            conn.commit()
        else:
            # If severity was downgraded below High, deactivate existing active alert for this incident
            cursor.execute("UPDATE emergency_alerts SET is_active = 0 WHERE incident_id = ?;", (incident_id,))
            conn.commit()
    else:
        cursor.execute("""
        INSERT INTO incidents (
            title, disaster_type, latitude, longitude, location_name,
            casualties, affected_population, damage_level, weather_condition,
            severity_level, risk_score, prediction_explanation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active');
        """, (
            payload.title, payload.disaster_type, payload.latitude, payload.longitude,
            payload.location_name, payload.casualties, payload.affected_population,
            payload.damage_level, payload.weather_condition, severity, risk_score, explanation
        ))
        conn.commit()
        incident_id = cursor.lastrowid
        
        # 2. Trigger automated emergency alert if Critical or High
        if severity in ["Critical", "High"]:
            cursor.execute("""
            INSERT INTO emergency_alerts (
                incident_id, alert_level, headline, message, is_active
            ) VALUES (?, ?, ?, ?, 1);
            """, (
                incident_id,
                severity,
                f"URGENT: {severity.upper()} SEVERITY INCIDENT - {payload.title}",
                f"{payload.location_name}: {severity} event detected by AI intelligence. Casualties: {payload.casualties}, Population: {payload.affected_population:,}. Risk Index: {risk_score}/100. Dispatch review required."
            ))
            conn.commit()

    # 3. Fetch newly inserted record
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    row = cursor.fetchone()
    return dict(row)

@router.post("/predict-severity", response_model=IncidentPredictionResponse)
def simulate_prediction(payload: IncidentPredictionRequest):
    """
    Direct ML inference endpoint for 'what-if' disaster scenario exploration and validation.
    Runs without persisting to database.
    """
    ml_output = predictor.predict(payload.model_dump())
    return ml_output

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    severity: Optional[str] = Query(None, description="Filter by severity (Low, Medium, High, Critical)"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Resolved)"),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieves all registered disaster incidents with optional filters."""
    cursor = conn.cursor()
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []
    
    if severity:
        query += " AND severity_level = ?"
        params.append(severity)
    if status:
        query += " AND status = ?"
        params.append(status)
        
    query += " ORDER BY id DESC;"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """Fetches full telemetry for a specific disaster incident."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return dict(row)
