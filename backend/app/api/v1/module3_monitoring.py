from fastapi import APIRouter, Depends, HTTPException
import sqlite3
from typing import List, Dict, Any
from app.core.database import get_db
from app.schemas.pydantic_schemas import DashboardSummary, EmergencyAlert

router = APIRouter(prefix="/monitoring", tags=["Module 3: Disaster Monitoring & Visualization"])

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(conn: sqlite3.Connection = Depends(get_db)):
    """
    Returns executive high-level disaster command metrics and KPI counters.
    """
    cursor = conn.cursor()
    
    # Incident severity counts
    cursor.execute("""
    SELECT 
        COUNT(*) as total_active,
        SUM(CASE WHEN severity_level = 'Critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity_level = 'High' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN severity_level = 'Medium' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN severity_level = 'Low' THEN 1 ELSE 0 END) as low_count,
        SUM(casualties) as total_casualties,
        SUM(affected_population) as total_affected
    FROM incidents WHERE status = 'Active';
    """)
    inc_row = cursor.fetchone()
    
    # Depot resource stats
    cursor.execute("""
    SELECT 
        SUM(ambulances) - SUM(available_ambulances) as amb_deployed,
        SUM(rescue_teams) - SUM(available_rescue_teams) as teams_deployed,
        SUM(boats) - SUM(available_boats) as boats_deployed,
        SUM(supplies) - SUM(available_supplies) as supplies_deployed,
        SUM(available_ambulances) as amb_available,
        SUM(available_rescue_teams) as teams_available,
        SUM(available_boats) as boats_available,
        SUM(available_supplies) as supplies_available
    FROM resource_depots;
    """)
    res_row = cursor.fetchone()
    
    return {
        "active_incidents": inc_row["total_active"] or 0,
        "critical_count": inc_row["critical_count"] or 0,
        "high_count": inc_row["high_count"] or 0,
        "medium_count": inc_row["medium_count"] or 0,
        "low_count": inc_row["low_count"] or 0,
        "total_casualties": inc_row["total_casualties"] or 0,
        "total_affected_population": inc_row["total_affected"] or 0,
        "total_ambulances_deployed": res_row["amb_deployed"] or 0,
        "total_rescue_teams_deployed": res_row["teams_deployed"] or 0,
        "total_boats_deployed": res_row["boats_deployed"] or 0,
        "total_supplies_deployed": res_row["supplies_deployed"] or 0,
        "total_ambulances_available": res_row["amb_available"] or 0,
        "total_rescue_teams_available": res_row["teams_available"] or 0,
        "total_boats_available": res_row["boats_available"] or 0,
        "total_supplies_available": res_row["supplies_available"] or 0,
    }

@router.get("/alerts", response_model=List[EmergencyAlert])
def get_emergency_alerts(conn: sqlite3.Connection = Depends(get_db)):
    """Fetches active high-priority emergency alerts and notifications."""
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, incident_id, alert_level, headline, message, is_active, created_at
    FROM emergency_alerts
    WHERE is_active = 1
    ORDER BY id DESC LIMIT 10;
    """)
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """Dismisses an active emergency alert."""
    cursor = conn.cursor()
    cursor.execute("UPDATE emergency_alerts SET is_active = 0 WHERE id = ?;", (alert_id,))
    conn.commit()
    return {"success": True, "message": f"Alert {alert_id} dismissed."}

@router.get("/map-telemetry")
def get_map_telemetry(conn: sqlite3.Connection = Depends(get_db)):
    """
    Returns complete geospatial coordinates, status metadata, and active
    dispatch route vectors for the interactive Leaflet Chennai disaster map.
    """
    cursor = conn.cursor()
    
    # 1. Active Incidents
    cursor.execute("SELECT * FROM incidents WHERE status = 'Active';")
    incidents = [dict(r) for r in cursor.fetchall()]
    
    # 2. Resource Depots
    cursor.execute("SELECT * FROM resource_depots;")
    depots = [dict(r) for r in cursor.fetchall()]
    
    # 3. Allocations with route vectors
    cursor.execute("""
    SELECT 
        a.id, a.incident_id, a.depot_id, a.status, a.distance_km,
        i.latitude as inc_lat, i.longitude as inc_lon, i.title as inc_title, i.severity_level,
        d.latitude as dep_lat, d.longitude as dep_lon, d.name as dep_name,
        a.allocated_ambulances, a.allocated_rescue_teams, a.allocated_boats, a.allocated_supplies
    FROM allocations a
    JOIN incidents i ON a.incident_id = i.id
    JOIN resource_depots d ON a.depot_id = d.id;
    """)
    alloc_rows = [dict(r) for r in cursor.fetchall()]
    
    dispatch_routes = []
    for row in alloc_rows:
        dispatch_routes.append({
            "allocation_id": row["id"],
            "status": row["status"],
            "distance_km": row["distance_km"],
            "incident": {
                "id": row["incident_id"],
                "title": row["inc_title"],
                "severity": row["severity_level"],
                "lat": row["inc_lat"],
                "lng": row["inc_lon"]
            },
            "depot": {
                "id": row["depot_id"],
                "name": row["dep_name"],
                "lat": row["dep_lat"],
                "lng": row["dep_lon"]
            },
            "resources": {
                "ambulances": row["allocated_ambulances"],
                "rescue_teams": row["allocated_rescue_teams"],
                "boats": row["allocated_boats"],
                "supplies": row["allocated_supplies"]
            }
        })
        
    return {
        "center": {"lat": 13.0450, "lng": 80.2200, "zoom": 11},
        "incidents": incidents,
        "depots": depots,
        "routes": dispatch_routes
    }

@router.get("/analytics-data")
def get_analytics_data(conn: sqlite3.Connection = Depends(get_db)):
    """
    Supplies aggregated telemetry datasets pre-structured for Plotly chart visualizers.
    """
    cursor = conn.cursor()
    
    # 1. Severity Distribution
    cursor.execute("""
    SELECT severity_level, COUNT(*) as count 
    FROM incidents 
    GROUP BY severity_level;
    """)
    sev_rows = cursor.fetchall()
    severity_distribution = {r["severity_level"]: r["count"] for r in sev_rows}
    for level in ["Low", "Medium", "High", "Critical"]:
        severity_distribution.setdefault(level, 0)
        
    # 2. Hazard Type Breakdown
    cursor.execute("""
    SELECT disaster_type, COUNT(*) as count, SUM(casualties) as total_cas, SUM(affected_population) as total_pop
    FROM incidents
    GROUP BY disaster_type;
    """)
    type_breakdown = [dict(r) for r in cursor.fetchall()]
    
    # 3. Depot Utilization
    cursor.execute("""
    SELECT 
        name,
        ambulances, available_ambulances,
        rescue_teams, available_rescue_teams,
        boats, available_boats,
        supplies, available_supplies
    FROM resource_depots;
    """)
    depot_utilization = []
    for r in cursor.fetchall():
        row = dict(r)
        depot_utilization.append({
            "name": row["name"],
            "deployed_ambulances": row["ambulances"] - row["available_ambulances"],
            "deployed_teams": row["rescue_teams"] - row["available_rescue_teams"],
            "deployed_boats": row["boats"] - row["available_boats"],
            "deployed_supplies": row["supplies"] - row["available_supplies"],
            "total_deployed": (
                (row["ambulances"] - row["available_ambulances"]) +
                (row["rescue_teams"] - row["available_rescue_teams"]) +
                (row["boats"] - row["available_boats"]) +
                (row["supplies"] - row["available_supplies"])
            )
        })
        
    # 4. Incident Risk Matrix
    cursor.execute("""
    SELECT id, title, disaster_type, casualties, damage_level, risk_score, severity_level
    FROM incidents
    ORDER BY risk_score DESC;
    """)
    risk_matrix = [dict(r) for r in cursor.fetchall()]

    return {
        "severity_distribution": severity_distribution,
        "hazard_type_breakdown": type_breakdown,
        "depot_utilization": depot_utilization,
        "risk_matrix": risk_matrix
    }
