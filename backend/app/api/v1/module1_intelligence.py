import base64
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
import sqlite3
from typing import List, Optional, Dict, Any
from app.core.database import get_db, get_db_context
from app.core.config import UPLOADS_DIR
from app.core.security import get_current_user, require_admin, require_citizen, get_optional_user
from app.schemas.pydantic_schemas import (
    IncidentCreate,
    IncidentResponse,
    IncidentPredictionRequest,
    IncidentPredictionResponse,
    CitizenReportCreate,
    SOSRequest,
    IncidentStatusUpdate
)
from app.ml.predictor import predictor

router = APIRouter(prefix="/incidents", tags=["Module 1: Disaster Intelligence & Severity Prediction"])

def save_base64_image(image_base64: str) -> Optional[str]:
    """Saves a base64 encoded evidence photo to the uploads directory and returns its URL."""
    try:
        if "," in image_base64:
            _, image_data = image_base64.split(",", 1)
        else:
            image_data = image_base64
            
        data = base64.b64decode(image_data)
        filename = f"evidence_{uuid.uuid4().hex[:12]}.jpg"
        target_path = UPLOADS_DIR / filename
        with open(target_path, "wb") as f:
            f.write(data)
        return f"/uploads/{filename}"
    except Exception as e:
        print(f"Warning: Failed to save uploaded image: {e}")
        return None

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

@router.post("/citizen-report", response_model=IncidentResponse, status_code=201)
def report_citizen_incident(
    payload: CitizenReportCreate,
    current_user: Dict[str, Any] = Depends(require_citizen),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Citizen-facing incident reporting intake.
    1. Saves evidence photo if provided (base64).
    2. Runs Scikit-learn Random Forest model inference.
    3. Persists report linked to the logged-in citizen with status 'Reported'.
    4. Triggers emergency alert if High/Critical severity.
    """
    image_url = None
    if payload.image_base64:
        image_url = save_base64_image(payload.image_base64)
        
    title = payload.title.strip() if payload.title else f"{payload.disaster_type} at {payload.location_name}"
    
    # Run Random Forest prediction
    ml_input = {
        "disaster_type": payload.disaster_type,
        "casualties": payload.casualties,
        "affected_population": payload.affected_population,
        "damage_level": payload.damage_level,
        "weather_condition": payload.weather_condition
    }
    ml_output = predictor.predict(ml_input)
    severity = ml_output["severity_level"]
    risk_score = ml_output["risk_score"]
    explanation = ml_output["explanation"]
    
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO incidents (
        title, disaster_type, latitude, longitude, location_name,
        casualties, affected_population, damage_level, weather_condition,
        severity_level, risk_score, prediction_explanation, status,
        reporter_id, description, image_url, is_sos, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reported', ?, ?, ?, 0, 'CITIZEN');
    """, (
        title, payload.disaster_type, payload.latitude, payload.longitude,
        payload.location_name, payload.casualties, payload.affected_population,
        payload.damage_level, payload.weather_condition, severity, risk_score,
        explanation, current_user["user_id"], payload.description, image_url
    ))
    conn.commit()
    incident_id = cursor.lastrowid
    
    # Broadcast alert if High or Critical
    if severity in ["Critical", "High"]:
        cursor.execute("""
        INSERT INTO emergency_alerts (
            incident_id, alert_level, headline, message, is_active
        ) VALUES (?, ?, ?, ?, 1);
        """, (
            incident_id,
            severity,
            f"CITIZEN REPORT: {severity.upper()} {payload.disaster_type} - {payload.location_name}",
            f"Citizen report by {current_user['full_name']}: {payload.description[:100]}... Assessed Risk Index: {risk_score}/100. Verification required."
        ))
        conn.commit()
        
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    return dict(cursor.fetchone())

@router.post("/sos", response_model=IncidentResponse, status_code=201)
def trigger_sos_emergency(
    payload: SOSRequest,
    current_user: Dict[str, Any] = Depends(require_citizen),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Rapid SOS Distress Request.
    Instant high-priority distress trigger creating Critical incident and flash alert.
    """
    title = f"URGENT SOS DISTRESS: {payload.location_name}"
    description = f"CRITICAL DISTRESS SIGNAL from Citizen {current_user['full_name']} (Phone: {payload.phone or current_user.get('phone') or 'Not provided'}). Note: {payload.note or 'Immediate evacuation requested'}"
    
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO incidents (
        title, disaster_type, latitude, longitude, location_name,
        casualties, affected_population, damage_level, weather_condition,
        severity_level, risk_score, prediction_explanation, status,
        reporter_id, description, image_url, is_sos, source
    ) VALUES (?, 'SOS Emergency', ?, ?, ?, 1, 5, 5, 'Emergency', 'Critical', 98.0, 'One-Click Citizen SOS Distress Trigger requiring immediate SAR triage.', 'Reported', ?, ?, NULL, 1, 'CITIZEN');
    """, (
        title, payload.latitude, payload.longitude, payload.location_name,
        current_user["user_id"], description
    ))
    conn.commit()
    incident_id = cursor.lastrowid
    
    cursor.execute("""
    INSERT INTO emergency_alerts (
        incident_id, alert_level, headline, message, is_active
    ) VALUES (?, 'Critical', ?, ?, 1);
    """, (
        incident_id,
        f"RED FLASH SOS: Citizen Emergency at {payload.location_name}",
        f"DISTRESS SIGNAL triggered by {current_user['full_name']} at coords ({payload.latitude:.4f}, {payload.longitude:.4f}). Immediate dispatch recommended."
    ))
    conn.commit()
    
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    return dict(cursor.fetchone())

@router.get("/my-reports")
def get_my_reports(
    current_user: Dict[str, Any] = Depends(require_citizen),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Retrieves all disaster reports and SOS alerts submitted by the current citizen,
    including real-time dispatch progress and assigned rescue units.
    """
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        i.*,
        COALESCE(SUM(a.allocated_ambulances), 0) as dispatched_ambulances,
        COALESCE(SUM(a.allocated_rescue_teams), 0) as dispatched_rescue_teams,
        COALESCE(SUM(a.allocated_boats), 0) as dispatched_boats,
        COALESCE(SUM(a.allocated_supplies), 0) as dispatched_supplies,
        MAX(a.created_at) as last_dispatch_time
    FROM incidents i
    LEFT JOIN allocations a ON i.id = a.incident_id AND a.status = 'Dispatched'
    WHERE i.reporter_id = ?
    GROUP BY i.id
    ORDER BY i.id DESC;
    """, (current_user["user_id"],))
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.get("/citizen-submissions")
def get_citizen_submissions(
    conn: sqlite3.Connection = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Admin-only review table of all on-ground citizen submissions and photos.
    """
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        i.*,
        u.username as reporter_username,
        u.full_name as reporter_name,
        u.phone as reporter_phone
    FROM incidents i
    LEFT JOIN users u ON i.reporter_id = u.id
    WHERE i.source = 'CITIZEN' OR i.is_sos = 1
    ORDER BY i.id DESC;
    """)
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.patch("/{incident_id}/status")
def update_incident_status(
    incident_id: int,
    payload: IncidentStatusUpdate,
    conn: sqlite3.Connection = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Admin command endpoint: Updates operational status of an incident
    ('Reported' -> 'Verified' -> 'Active' -> 'Dispatched' -> 'Resolved').
    Verified citizen incidents automatically enter the OR-Tools optimization pool.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    inc = cursor.fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    cursor.execute("""
    UPDATE incidents SET
        status = ?
    WHERE id = ?;
    """, (payload.status, incident_id))
    conn.commit()
    
    # If resolved, deactivate any associated alerts
    if payload.status == "Resolved":
        cursor.execute("UPDATE emergency_alerts SET is_active = 0 WHERE incident_id = ?;", (incident_id,))
        conn.commit()
        
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    return {
        "success": True,
        "incident_id": incident_id,
        "status": payload.status,
        "commander_notes": payload.commander_notes,
        "updated_incident": dict(cursor.fetchone())
    }
