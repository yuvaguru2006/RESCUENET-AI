from fastapi import APIRouter, Depends, HTTPException, Body
import sqlite3
from typing import List, Dict, Any
from app.core.database import get_db, get_db_context
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
    """Retrieves all regional resource depots and current inventory levels."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM resource_depots ORDER BY id ASC;")
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/solve", response_model=OptimizationResult)
def run_optimization(conn: sqlite3.Connection = Depends(get_db)):
    """
    Executes Google OR-Tools Mixed-Integer Programming solver across all active
    incidents and available depot resources. Generates proposed optimal allocations.
    """
    cursor = conn.cursor()
    
    # Fetch active incidents
    cursor.execute("SELECT * FROM incidents WHERE status = 'Active' ORDER BY id ASC;")
    incidents = [dict(r) for r in cursor.fetchall()]
    
    # Fetch depots with currently available stocks
    cursor.execute("SELECT * FROM resource_depots ORDER BY id ASC;")
    depots = [dict(r) for r in cursor.fetchall()]
    
    # Run genuine OR-Tools solver
    result = optimization_solver.solve(incidents, depots)
    
    # Clear previous proposed (unapproved) allocations in database
    cursor.execute("DELETE FROM allocations WHERE status = 'Proposed';")
    
    # Save newly proposed allocations to DB
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
def list_allocations(conn: sqlite3.Connection = Depends(get_db)):
    """Retrieves all resource allocations with joined incident and depot details."""
    cursor = conn.cursor()
    cursor.execute("""
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
    ORDER BY a.id DESC;
    """)
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

@router.post("/approve-dispatch")
def approve_dispatch(payload: ApprovalRequest, conn: sqlite3.Connection = Depends(get_db)):
    """
    Human-in-the-Loop Approval:
    Formally approves proposed AI recommendations and dispatches emergency units.
    Decrements available inventories at the corresponding resource depots in the database.
    """
    cursor = conn.cursor()
    approved_count = 0
    
    for alloc_id in payload.allocation_ids:
        # Check allocation status
        cursor.execute("SELECT * FROM allocations WHERE id = ?;", (alloc_id,))
        alloc = cursor.fetchone()
        if not alloc:
            continue
        
        alloc_dict = dict(alloc)
        if alloc_dict["status"] == "Dispatched":
            continue # already dispatched
            
        depot_id = alloc_dict["depot_id"]
        
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
        
        # Update allocation status to Dispatched
        cursor.execute("""
        UPDATE allocations SET
            status = 'Dispatched',
            approved_by_human = 1
        WHERE id = ?;
        """, (alloc_id,))
        
        approved_count += 1
        
    conn.commit()
    return {
        "success": True,
        "approved_count": approved_count,
        "message": f"Successfully approved and dispatched {approved_count} allocation orders.",
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
