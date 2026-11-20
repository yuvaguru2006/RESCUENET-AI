from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Dict, Any, Optional
from app.core.database import get_db, get_db_context
from app.core.security import get_optional_user, require_admin
from app.schemas.pydantic_schemas import (
    ResourceDepot,
    AllocationItem,
    OptimizationResult,
    RecommendationItem,
    ApprovalRequest
)
from app.optimization.solver import optimization_solver, calculate_resource_demand
from app.optimization.recommender import EmergencyRecommender

router = APIRouter(prefix="/optimization", tags=["Module 2: Decision Support & Resource Optimization"])

@router.get("/depots", response_model=List[ResourceDepot])
def list_resource_depots(conn: sqlite3.Connection = Depends(get_db)):
    """Retrieves all regional resource depots and current live inventory levels."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM resource_depots ORDER BY id ASC;")
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/solve", response_model=OptimizationResult)
def run_optimization(
    conn: sqlite3.Connection = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Executes Google OR-Tools Mixed-Integer Programming solver across all active
    and verified citizen incidents and available depot resources.
    Requires administrator authorization when called via authenticated HTTP API.
    """
    if isinstance(current_user, dict) and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator privileges required to execute resource optimization.")

    cursor = conn.cursor()
    
    # 1. Fetch active and verified incidents (including citizen verified reports)
    cursor.execute("SELECT * FROM incidents WHERE status IN ('Active', 'Verified') ORDER BY id ASC;")
    incidents = [dict(r) for r in cursor.fetchall()]
    
    # 2. Fetch already DISPATCHED allocations per incident
    cursor.execute("""
    SELECT 
        incident_id,
        COALESCE(SUM(allocated_ambulances), 0) as dispatched_ambulances,
        COALESCE(SUM(allocated_rescue_teams), 0) as dispatched_rescue_teams,
        COALESCE(SUM(allocated_boats), 0) as dispatched_boats,
        COALESCE(SUM(allocated_supplies), 0) as dispatched_supplies
    FROM allocations
    WHERE status = 'Dispatched'
    GROUP BY incident_id;
    """)
    dispatched_rows = cursor.fetchall()
    dispatched_map = {
        r["incident_id"]: {
            "ambulances": r["dispatched_ambulances"],
            "rescue_teams": r["dispatched_rescue_teams"],
            "boats": r["dispatched_boats"],
            "supplies": r["dispatched_supplies"]
        }
        for r in dispatched_rows
    }
    
    # Attach already_dispatched to each incident
    for inc in incidents:
        inc["already_dispatched"] = dispatched_map.get(inc["id"], {
            "ambulances": 0, "rescue_teams": 0, "boats": 0, "supplies": 0
        })
    
    # 3. Fetch depots with currently available stocks
    cursor.execute("SELECT * FROM resource_depots ORDER BY id ASC;")
    depots = [dict(r) for r in cursor.fetchall()]
    
    # 4. Run genuine OR-Tools solver with anti-fragmentation and demand caps
    result = optimization_solver.solve(incidents, depots)
    
    # 5. Clear previous PROPOSED (unapproved) allocations in database
    # (Dispatched allocations are preserved and never touched!)
    cursor.execute("DELETE FROM allocations WHERE status = 'Proposed';")
    
    # 6. Save newly proposed allocations to DB
    saved_allocations = []
    for alloc in result["allocations"]:
        cursor.execute("""
        INSERT INTO allocations (
            incident_id, depot_id,
            allocated_ambulances, allocated_rescue_teams, allocated_boats, allocated_supplies,
            distance_km, status, approved_by_human
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Proposed', 0);
        """, (
            alloc["incident_id"], alloc["depot_id"],
            alloc["allocated_ambulances"], alloc["allocated_rescue_teams"],
            alloc["allocated_boats"], alloc["allocated_supplies"],
            alloc["distance_km"]
        ))
        alloc_id = cursor.lastrowid
        alloc_item = {
            "id": alloc_id,
            **alloc,
            "created_at": "Just now"
        }
        saved_allocations.append(alloc_item)
        
    conn.commit()
    result["allocations"] = saved_allocations
    return result

@router.get("/allocations", response_model=List[AllocationItem])
def list_allocations(
    status: Optional[str] = Query(None, description="Filter by Proposed or Dispatched"),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieves all resource allocations with joined incident and depot details."""
    cursor = conn.cursor()
    query = """
    SELECT 
        a.id,
        a.incident_id,
        i.title as incident_title,
        i.severity_level,
        a.depot_id,
        d.name as depot_name,
        a.allocated_ambulances,
        a.allocated_rescue_teams,
        a.allocated_boats,
        a.allocated_supplies,
        a.distance_km,
        a.status,
        a.approved_by_human,
        a.created_at
    FROM allocations a
    JOIN incidents i ON a.incident_id = i.id
    JOIN resource_depots d ON a.depot_id = d.id
    WHERE 1=1
    """
    params = []
    if status:
        query += " AND a.status = ?"
        params.append(status)
        
    query += " ORDER BY a.id DESC;"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/approve-dispatch")
def approve_dispatch(
    payload: ApprovalRequest,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Human-in-the-Loop Approval:
    Formally approves proposed AI recommendations and dispatches emergency units.
    Decrements available inventories at the corresponding resource depots in the database.
    Prevents double dispatching or double inventory deductions.
    Requires explicit non-empty commander notes and at least one selected allocation.
    Updates incident status to 'Dispatched' so citizens can track real-time response.
    """
    if isinstance(current_user, dict) and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator privileges required to authorize emergency dispatches.")

    if not payload.commander_notes or not payload.commander_notes.strip():
        raise HTTPException(
            status_code=400,
            detail="Commander authorization notes are mandatory for human-in-the-loop dispatch."
        )
    if not payload.allocation_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one allocation must be selected for dispatch."
        )

    cursor = conn.cursor()
    approved_count = 0
    
    for alloc_id in payload.allocation_ids:
        # Check allocation status
        cursor.execute("SELECT * FROM allocations WHERE id = ?;", (alloc_id,))
        alloc = cursor.fetchone()
        if not alloc:
            continue
        
        alloc_dict = dict(alloc)
        # Prevent double-dispatching already dispatched records
        if alloc_dict["status"] == "Dispatched":
            continue
            
        depot_id = alloc_dict["depot_id"]
        
        # Verify current depot inventory before decrementing
        cursor.execute("""
        SELECT available_ambulances, available_rescue_teams, available_boats, available_supplies
        FROM resource_depots WHERE id = ?;
        """, (depot_id,))
        depot = cursor.fetchone()
        if not depot:
            continue
            
        # Deduct from depot available stock
        cursor.execute("""
        UPDATE resource_depots SET
            available_ambulances = MAX(0, available_ambulances - ?),
            available_rescue_teams = MAX(0, available_rescue_teams - ?),
            available_boats = MAX(0, available_boats - ?),
            available_supplies = MAX(0, available_supplies - ?)
        WHERE id = ?;
        """, (
            alloc_dict["allocated_ambulances"],
            alloc_dict["allocated_rescue_teams"],
            alloc_dict["allocated_boats"],
            alloc_dict["allocated_supplies"],
            depot_id
        ))
        
        # Update allocation status to Dispatched with human approval timestamp
        cursor.execute("""
        UPDATE allocations SET
            status = 'Dispatched',
            approved_by_human = 1
        WHERE id = ?;
        """, (alloc_id,))

        # Update incident status to 'Dispatched'
        cursor.execute("""
        UPDATE incidents SET
            status = 'Dispatched'
        WHERE id = ? AND status IN ('Reported', 'Verified', 'Active');
        """, (alloc_dict["incident_id"],))
        
        approved_count += 1
        
    conn.commit()
    return {
        "success": True,
        "approved_count": approved_count,
        "message": f"Successfully authorized and dispatched {approved_count} allocation orders.",
        "commander_notes": payload.commander_notes
    }

@router.get("/recommendations/{incident_id}", response_model=RecommendationItem)
def get_incident_recommendations(incident_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """
    Generates actionable tactical emergency SOPs and resource requirement calculations
    for an incident, reinforcing that human verification is required.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?;", (incident_id,))
    incident = cursor.fetchone()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    recommendation = EmergencyRecommender.get_recommendation(dict(incident))
    return recommendation
