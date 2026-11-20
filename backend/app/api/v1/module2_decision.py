from fastapi import APIRouter, Depends, HTTPException, Query
import sqlite3
from typing import List, Dict, Any, Optional
from app.core.database import get_db, get_db_context
from app.core.security import get_optional_user, require_admin
from app.schemas.pydantic_schemas import (
    ResourceDepot,
    DepotCreate,
    DepotUpdate,
    AllocationItem,
    OptimizationResult,
    RecommendationItem,
    ApprovalRequest,
    IncidentDemandsResponse,
    IncidentDemandItem
)
from app.optimization.solver import optimization_solver, calculate_resource_demand
from app.optimization.recommender import EmergencyRecommender

router = APIRouter(prefix="/optimization", tags=["Module 2: Decision Support & Resource Optimization"])

@router.get("/depots", response_model=List[ResourceDepot])
def list_resource_depots(conn: sqlite3.Connection = Depends(get_db)):
    """Retrieves all regional resource depots and current live inventory levels with allocated stock."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM resource_depots ORDER BY id ASC;")
    rows = cursor.fetchall()
    depots = []
    for r in rows:
        d = dict(r)
        d["allocated_ambulances"] = max(0, d["ambulances"] - d["available_ambulances"])
        d["allocated_rescue_teams"] = max(0, d["rescue_teams"] - d["available_rescue_teams"])
        d["allocated_boats"] = max(0, d["boats"] - d["available_boats"])
        d["allocated_supplies"] = max(0, d["supplies"] - d["available_supplies"])
        depots.append(d)
    return depots

@router.post("/depots", response_model=ResourceDepot, status_code=201)
def create_resource_depot(
    payload: DepotCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Commander endpoint: Adds a new regional emergency resource depot to SQLite database.
    Requires administrator authorization.
    """
    if isinstance(current_user, dict) and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator privileges required to add resource depots.")

    cursor = conn.cursor()
    cursor.execute("SELECT id FROM resource_depots WHERE LOWER(name) = LOWER(?);", (payload.name.strip(),))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="A depot with this name already exists in Chennai region.")

    cursor.execute("""
    INSERT INTO resource_depots (
        name, latitude, longitude,
        ambulances, rescue_teams, boats, supplies,
        available_ambulances, available_rescue_teams, available_boats, available_supplies
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        payload.name.strip(), payload.latitude, payload.longitude,
        payload.ambulances, payload.rescue_teams, payload.boats, payload.supplies,
        payload.ambulances, payload.rescue_teams, payload.boats, payload.supplies
    ))
    conn.commit()
    depot_id = cursor.lastrowid
    cursor.execute("SELECT * FROM resource_depots WHERE id = ?;", (depot_id,))
    row = dict(cursor.fetchone())
    row["allocated_ambulances"] = 0
    row["allocated_rescue_teams"] = 0
    row["allocated_boats"] = 0
    row["allocated_supplies"] = 0
    return row

@router.put("/depots/{depot_id}", response_model=ResourceDepot)
def update_resource_depot(
    depot_id: int,
    payload: DepotUpdate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Commander endpoint: Updates depot inventory levels, stock quantities, or metadata in SQLite.
    Requires administrator authorization.
    """
    if isinstance(current_user, dict) and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator privileges required to update depot inventory.")

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM resource_depots WHERE id = ?;", (depot_id,))
    depot = cursor.fetchone()
    if not depot:
        raise HTTPException(status_code=404, detail="Resource depot not found.")

    current = dict(depot)
    name = payload.name.strip() if payload.name else current["name"]
    latitude = payload.latitude if payload.latitude is not None else current["latitude"]
    longitude = payload.longitude if payload.longitude is not None else current["longitude"]

    ambulances = payload.ambulances if payload.ambulances is not None else current["ambulances"]
    rescue_teams = payload.rescue_teams if payload.rescue_teams is not None else current["rescue_teams"]
    boats = payload.boats if payload.boats is not None else current["boats"]
    supplies = payload.supplies if payload.supplies is not None else current["supplies"]

    # Calculate allocated stock before modification
    allocated_amb = max(0, current["ambulances"] - current["available_ambulances"])
    allocated_teams = max(0, current["rescue_teams"] - current["available_rescue_teams"])
    allocated_boats = max(0, current["boats"] - current["available_boats"])
    allocated_supplies = max(0, current["supplies"] - current["available_supplies"])

    # If available quantities are specified, use them; otherwise adjust dynamically
    available_amb = payload.available_ambulances if payload.available_ambulances is not None else max(0, ambulances - allocated_amb)
    available_teams = payload.available_rescue_teams if payload.available_rescue_teams is not None else max(0, rescue_teams - allocated_teams)
    available_boats = payload.available_boats if payload.available_boats is not None else max(0, boats - allocated_boats)
    available_supplies = payload.available_supplies if payload.available_supplies is not None else max(0, supplies - allocated_supplies)

    # Bound available quantities to total capacity
    available_amb = min(available_amb, ambulances)
    available_teams = min(available_teams, rescue_teams)
    available_boats = min(available_boats, boats)
    available_supplies = min(available_supplies, supplies)

    cursor.execute("""
    UPDATE resource_depots SET
        name = ?, latitude = ?, longitude = ?,
        ambulances = ?, rescue_teams = ?, boats = ?, supplies = ?,
        available_ambulances = ?, available_rescue_teams = ?, available_boats = ?, available_supplies = ?
    WHERE id = ?;
    """, (
        name, latitude, longitude,
        ambulances, rescue_teams, boats, supplies,
        available_amb, available_teams, available_boats, available_supplies,
        depot_id
    ))
    conn.commit()

    cursor.execute("SELECT * FROM resource_depots WHERE id = ?;", (depot_id,))
    row = dict(cursor.fetchone())
    row["allocated_ambulances"] = max(0, row["ambulances"] - row["available_ambulances"])
    row["allocated_rescue_teams"] = max(0, row["rescue_teams"] - row["available_rescue_teams"])
    row["allocated_boats"] = max(0, row["boats"] - row["available_boats"])
    row["allocated_supplies"] = max(0, row["supplies"] - row["available_supplies"])
    return row

@router.delete("/depots/{depot_id}")
def delete_resource_depot(
    depot_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    """
    Commander endpoint: Deletes a resource depot if no active dispatched allocations depend on it.
    Requires administrator authorization.
    """
    if isinstance(current_user, dict) and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator privileges required to delete depots.")

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM resource_depots WHERE id = ?;", (depot_id,))
    depot = cursor.fetchone()
    if not depot:
        raise HTTPException(status_code=404, detail="Resource depot not found.")

    # Check if there are active dispatched allocations
    cursor.execute("SELECT COUNT(*) FROM allocations WHERE depot_id = ? AND status = 'Dispatched';", (depot_id,))
    if cursor.fetchone()[0] > 0:
        raise HTTPException(status_code=400, detail="Cannot delete depot with active dispatched emergency operations.")

    # Clear any proposed allocations tied to this depot
    cursor.execute("DELETE FROM allocations WHERE depot_id = ? AND status = 'Proposed';", (depot_id,))
    cursor.execute("DELETE FROM resource_depots WHERE id = ?;", (depot_id,))
    conn.commit()
    return {"success": True, "message": f"Resource depot '{depot['name']}' successfully removed."}

@router.get("/demands", response_model=IncidentDemandsResponse)
def get_incident_demands(conn: sqlite3.Connection = Depends(get_db)):
    """
    Calculates resource requirements for all active and verified incidents using
    disaster intelligence (disaster type, severity, casualties, affected population, damage level).
    Returns gross demand, already dispatched assets, net remaining demand, and compares
    aggregated regional demand against currently available depot inventory stock.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE status IN ('Active', 'Verified', 'Reported') ORDER BY id ASC;")
    incidents = [dict(r) for r in cursor.fetchall()]

    # Fetch already dispatched allocations
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

    # Fetch total available stocks across all depots
    cursor.execute("""
    SELECT 
        COALESCE(SUM(available_ambulances), 0) as total_amb,
        COALESCE(SUM(available_rescue_teams), 0) as total_teams,
        COALESCE(SUM(available_boats), 0) as total_boats,
        COALESCE(SUM(available_supplies), 0) as total_supplies
    FROM resource_depots;
    """)
    stock_row = cursor.fetchone()
    total_available = {
        "ambulances": stock_row["total_amb"] or 0,
        "rescue_teams": stock_row["total_teams"] or 0,
        "boats": stock_row["total_boats"] or 0,
        "supplies": stock_row["total_supplies"] or 0
    }

    demand_items = []
    agg_gross = {"ambulances": 0, "rescue_teams": 0, "boats": 0, "supplies": 0}
    agg_disp = {"ambulances": 0, "rescue_teams": 0, "boats": 0, "supplies": 0}
    agg_net = {"ambulances": 0, "rescue_teams": 0, "boats": 0, "supplies": 0}

    for inc in incidents:
        gross = calculate_resource_demand(inc)
        disp = dispatched_map.get(inc["id"], {"ambulances": 0, "rescue_teams": 0, "boats": 0, "supplies": 0})
        net = {
            r: max(0, gross[r] - disp[r])
            for r in ["ambulances", "rescue_teams", "boats", "supplies"]
        }

        for r in ["ambulances", "rescue_teams", "boats", "supplies"]:
            agg_gross[r] += gross[r]
            agg_disp[r] += disp[r]
            agg_net[r] += net[r]

        demand_items.append({
            "incident_id": inc["id"],
            "title": inc["title"],
            "disaster_type": inc["disaster_type"],
            "severity_level": inc["severity_level"],
            "risk_score": inc["risk_score"],
            "location_name": inc["location_name"],
            "latitude": inc["latitude"],
            "longitude": inc["longitude"],
            "casualties": inc["casualties"],
            "affected_population": inc["affected_population"],
            "damage_level": inc["damage_level"],
            "gross_demand": gross,
            "already_dispatched": disp,
            "net_demand": net
        })

    stock_status = {
        r: "SUFFICIENT" if total_available[r] >= agg_net[r] else f"DEFICIT (-{agg_net[r] - total_available[r]})"
        for r in ["ambulances", "rescue_teams", "boats", "supplies"]
    }

    return {
        "total_active_incidents": len(demand_items),
        "incidents": demand_items,
        "aggregated_gross_demand": agg_gross,
        "aggregated_dispatched": agg_disp,
        "aggregated_net_demand": agg_net,
        "total_available_stock": total_available,
        "stock_status": stock_status
    }

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
    Human-in-the-Loop Approval & Transactional Inventory Management:
    - If approved is True: formally authorizes proposed allocations, decrements available
      depot stock in SQLite, updates allocation status to 'Dispatched', and sets incident status.
    - If approved is False: rejects/cancels the proposed allocations WITHOUT touching depot inventory.
    - Strict protection: prevents duplicate approvals, double deduction, and concurrent race hazards.
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
    processed_count = 0
    
    if payload.approved:
        # APPROVAL & FIELD DISPATCH WORKFLOW
        for alloc_id in payload.allocation_ids:
            cursor.execute("SELECT * FROM allocations WHERE id = ?;", (alloc_id,))
            alloc = cursor.fetchone()
            if not alloc:
                continue
            
            alloc_dict = dict(alloc)
            # Only process Proposed allocations - prevents double dispatching or double inventory deductions
            if alloc_dict["status"] != "Proposed":
                continue
                
            depot_id = alloc_dict["depot_id"]
            
            cursor.execute("""
            SELECT available_ambulances, available_rescue_teams, available_boats, available_supplies
            FROM resource_depots WHERE id = ?;
            """, (depot_id,))
            depot = cursor.fetchone()
            if not depot:
                continue
                
            # Transactionally deduct from depot available stock in SQLite
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

            # Update incident status to 'Dispatched'
            cursor.execute("""
            UPDATE incidents SET
                status = 'Dispatched'
            WHERE id = ? AND status IN ('Reported', 'Verified', 'Active');
            """, (alloc_dict["incident_id"],))
            
            processed_count += 1
            
        conn.commit()
        return {
            "success": True,
            "approved_count": processed_count,
            "rejected_count": 0,
            "status": "Dispatched",
            "message": f"Successfully authorized and dispatched {processed_count} allocation orders.",
            "commander_notes": payload.commander_notes
        }
    else:
        # REJECTION / CANCELLATION WORKFLOW
        # Explicitly marked as Rejected - DOES NOT touch or deduct depot inventory!
        for alloc_id in payload.allocation_ids:
            cursor.execute("SELECT * FROM allocations WHERE id = ?;", (alloc_id,))
            alloc = cursor.fetchone()
            if not alloc:
                continue
            alloc_dict = dict(alloc)
            if alloc_dict["status"] == "Proposed":
                cursor.execute("""
                UPDATE allocations SET
                    status = 'Rejected',
                    approved_by_human = 0
                WHERE id = ?;
                """, (alloc_id,))
                processed_count += 1
                
        conn.commit()
        return {
            "success": True,
            "approved_count": 0,
            "rejected_count": processed_count,
            "status": "Rejected",
            "message": f"Successfully rejected {processed_count} proposed allocations without deducting depot inventory.",
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
