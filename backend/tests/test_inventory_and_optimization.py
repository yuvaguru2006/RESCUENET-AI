import os
os.environ["TESTING"] = "1"

import pytest
from fastapi import HTTPException
from app.core.database import get_connection, init_db
from app.schemas.pydantic_schemas import (
    DepotCreate,
    DepotUpdate,
    ApprovalRequest,
    IncidentCreate
)
from app.api.v1.module1_intelligence import register_incident
from app.api.v1.module2_decision import (
    list_resource_depots,
    create_resource_depot,
    update_resource_depot,
    delete_resource_depot,
    get_incident_demands,
    run_optimization,
    approve_dispatch,
    list_allocations
)
from seed_data import seed_database

@pytest.fixture(scope="module")
def setup_db():
    init_db()
    seed_database(force_reset=True)
    conn = get_connection()
    yield conn
    conn.close()

def test_depot_creation_by_admin(setup_db):
    """Verifies that an Administrator can create a new resource depot in SQLite."""
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}
    
    payload = DepotCreate(
        name="Porur Disaster Response Depot",
        latitude=13.0382,
        longitude=80.1565,
        ambulances=12,
        rescue_teams=8,
        boats=5,
        supplies=140
    )
    
    depot = create_resource_depot(payload, setup_db, mock_admin)
    assert depot["id"] > 0
    assert depot["name"] == "Porur Disaster Response Depot"
    assert depot["ambulances"] == 12
    assert depot["available_ambulances"] == 12
    assert depot["supplies"] == 140
    assert depot["available_supplies"] == 140

    # Verify directly in SQLite
    cursor = setup_db.cursor()
    cursor.execute("SELECT * FROM resource_depots WHERE id = ?;", (depot["id"],))
    row = cursor.fetchone()
    assert row is not None
    assert row["name"] == "Porur Disaster Response Depot"

def test_depot_creation_forbidden_for_citizen(setup_db):
    """Verifies that a Citizen receives HTTP 403 when trying to add a resource depot."""
    mock_citizen = {"user_id": 2, "username": "citizen", "role": "CITIZEN"}
    payload = DepotCreate(
        name="Unauthorized Citizen Depot",
        latitude=13.0000,
        longitude=80.2000,
        ambulances=5,
        rescue_teams=5,
        boats=5,
        supplies=50
    )
    with pytest.raises(HTTPException) as exc:
        create_resource_depot(payload, setup_db, mock_citizen)
    assert exc.value.status_code == 403

def test_depot_inventory_update_by_admin(setup_db):
    """Verifies that an Administrator can update stock quantities in SQLite."""
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}
    
    # Update Egmore Depot (id: 1)
    update_payload = DepotUpdate(
        ambulances=30,
        available_ambulances=28,
        supplies=350,
        available_supplies=340
    )
    updated = update_resource_depot(1, update_payload, setup_db, mock_admin)
    assert updated["ambulances"] == 30
    assert updated["available_ambulances"] == 28
    assert updated["supplies"] == 350
    assert updated["available_supplies"] == 340
    assert updated["allocated_ambulances"] == 2

    # Verify directly in SQLite
    cursor = setup_db.cursor()
    cursor.execute("SELECT ambulances, available_ambulances FROM resource_depots WHERE id = 1;")
    row = cursor.fetchone()
    assert row["ambulances"] == 30
    assert row["available_ambulances"] == 28

def test_depot_inventory_update_forbidden_for_citizen(setup_db):
    """Verifies that a Citizen receives HTTP 403 when trying to update depot stock."""
    mock_citizen = {"user_id": 2, "username": "citizen", "role": "CITIZEN"}
    with pytest.raises(HTTPException) as exc:
        update_resource_depot(1, DepotUpdate(ambulances=99), setup_db, mock_citizen)
    assert exc.value.status_code == 403

def test_get_incident_demands_before_optimization(setup_db):
    """
    Verifies that get_incident_demands computes gross requirements,
    dispatched assets, and net demand before optimization runs.
    """
    demands = get_incident_demands(setup_db)
    assert demands["total_active_incidents"] > 0
    assert len(demands["incidents"]) > 0
    assert "ambulances" in demands["aggregated_gross_demand"]
    assert "ambulances" in demands["total_available_stock"]
    assert "ambulances" in demands["stock_status"]

    sample_inc = demands["incidents"][0]
    assert sample_inc["gross_demand"]["ambulances"] > 0
    assert sample_inc["net_demand"]["ambulances"] >= 0

def test_optimization_with_real_sqlite_inventory(setup_db):
    """
    Verifies that the Google OR-Tools solver reads actual SQLite depot stock
    and generates feasible proposed allocations.
    """
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}
    opt_result = run_optimization(setup_db, mock_admin)
    assert opt_result["status"] in ["OPTIMAL", "FEASIBLE"]
    assert len(opt_result["allocations"]) > 0
    for alloc in opt_result["allocations"]:
        assert alloc["status"] == "Proposed"
        assert alloc["approved_by_human"] is False

def test_insufficient_depot_stock_reports_shortages(setup_db):
    """
    Tests that when depot available stock is artificially depleted,
    the OR-Tools solver identifies unmet demand without crashing,
    and returns the exact shortage quantities.
    """
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}
    cursor = setup_db.cursor()

    # Temporarily deplete all available boats in all depots
    cursor.execute("UPDATE resource_depots SET available_boats = 0;")
    setup_db.commit()

    # Run optimizer
    opt_result = run_optimization(setup_db, mock_admin)
    assert opt_result["status"] in ["OPTIMAL", "FEASIBLE"]
    assert len(opt_result["unmet_demand"]) > 0

    # At least one incident with Flood/Cyclone must report an unmet boats demand
    has_boat_shortage = any(
        shortages.get("boats", 0) > 0
        for shortages in opt_result["unmet_demand"].values()
    )
    assert has_boat_shortage is True

    # Restore some boats for subsequent tests
    cursor.execute("UPDATE resource_depots SET available_boats = boats;")
    setup_db.commit()

def test_approval_transaction_deducts_sqlite_inventory(setup_db):
    """
    Verifies that approving proposed allocations transactionally decrements
    available inventory in SQLite and updates status to 'Dispatched'.
    """
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}

    # Run optimization to generate proposed allocations
    run_optimization(setup_db, mock_admin)

    # Get a proposed allocation
    allocations = list_allocations(status="Proposed", conn=setup_db)
    assert len(allocations) > 0
    target_alloc = allocations[0]
    target_id = target_alloc["id"]
    depot_id = target_alloc["depot_id"]
    alloc_amb = target_alloc["allocated_ambulances"]

    # Check stock before
    cursor = setup_db.cursor()
    cursor.execute("SELECT available_ambulances FROM resource_depots WHERE id = ?;", (depot_id,))
    amb_before = cursor.fetchone()["available_ambulances"]

    # Approve
    req = ApprovalRequest(
        allocation_ids=[target_id],
        approved=True,
        commander_notes="Authorized by Operations Director for immediate field dispatch"
    )
    res = approve_dispatch(req, setup_db, mock_admin)
    assert res["success"] is True
    assert res["approved_count"] == 1
    assert res["status"] == "Dispatched"

    # Verify inventory was deducted in SQLite
    cursor.execute("SELECT available_ambulances FROM resource_depots WHERE id = ?;", (depot_id,))
    amb_after = cursor.fetchone()["available_ambulances"]
    assert amb_after == amb_before - alloc_amb

    # Verify allocation status is Dispatched
    cursor.execute("SELECT status, approved_by_human FROM allocations WHERE id = ?;", (target_id,))
    alloc_row = cursor.fetchone()
    assert alloc_row["status"] == "Dispatched"
    assert alloc_row["approved_by_human"] == 1

def test_rejection_does_not_deduct_sqlite_inventory(setup_db):
    """
    Verifies that rejecting proposed allocations marks them as 'Rejected'
    and DOES NOT deduct any depot inventory from SQLite.
    """
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}

    # Run optimization to ensure fresh proposed allocations exist
    run_optimization(setup_db, mock_admin)
    allocations = list_allocations(status="Proposed", conn=setup_db)
    assert len(allocations) > 0
    target_alloc = allocations[0]
    target_id = target_alloc["id"]
    depot_id = target_alloc["depot_id"]

    cursor = setup_db.cursor()
    cursor.execute("SELECT available_ambulances, available_supplies FROM resource_depots WHERE id = ?;", (depot_id,))
    stock_before = dict(cursor.fetchone())

    # Reject
    req = ApprovalRequest(
        allocation_ids=[target_id],
        approved=False,
        commander_notes="Cancelled: Local weather conditions make air transit unsafe"
    )
    res = approve_dispatch(req, setup_db, mock_admin)
    assert res["success"] is True
    assert res["approved_count"] == 0
    assert res["rejected_count"] == 1
    assert res["status"] == "Rejected"

    # Verify inventory was NOT deducted in SQLite
    cursor.execute("SELECT available_ambulances, available_supplies FROM resource_depots WHERE id = ?;", (depot_id,))
    stock_after = dict(cursor.fetchone())
    assert stock_after["available_ambulances"] == stock_before["available_ambulances"]
    assert stock_after["available_supplies"] == stock_before["available_supplies"]

    # Verify allocation status changed to Rejected
    cursor.execute("SELECT status, approved_by_human FROM allocations WHERE id = ?;", (target_id,))
    alloc_row = cursor.fetchone()
    assert alloc_row["status"] == "Rejected"
    assert alloc_row["approved_by_human"] == 0

def test_prevent_duplicate_approval_and_double_deduction(setup_db):
    """
    Verifies that re-approving an already dispatched allocation skips it
    and prevents double inventory deductions.
    """
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}

    # Find an already Dispatched allocation
    cursor = setup_db.cursor()
    cursor.execute("SELECT id, depot_id, allocated_ambulances FROM allocations WHERE status = 'Dispatched' LIMIT 1;")
    disp_row = cursor.fetchone()
    assert disp_row is not None
    disp_id = disp_row["id"]
    depot_id = disp_row["depot_id"]

    cursor.execute("SELECT available_ambulances FROM resource_depots WHERE id = ?;", (depot_id,))
    stock_before = cursor.fetchone()["available_ambulances"]

    # Try to approve it again
    req = ApprovalRequest(
        allocation_ids=[disp_id],
        approved=True,
        commander_notes="Duplicate approval attempt"
    )
    res = approve_dispatch(req, setup_db, mock_admin)
    assert res["approved_count"] == 0 # Skipped because status != 'Proposed'

    # Inventory must remain completely unchanged
    cursor.execute("SELECT available_ambulances FROM resource_depots WHERE id = ?;", (depot_id,))
    stock_after = cursor.fetchone()["available_ambulances"]
    assert stock_after == stock_before

def test_delete_depot_prevents_active_dispatch(setup_db):
    """
    Verifies that a depot cannot be deleted if active dispatches originate from it.
    """
    mock_admin = {"user_id": 1, "username": "admin", "role": "ADMIN"}
    cursor = setup_db.cursor()
    cursor.execute("SELECT depot_id FROM allocations WHERE status = 'Dispatched' LIMIT 1;")
    active_depot_id = cursor.fetchone()["depot_id"]

    with pytest.raises(HTTPException) as exc:
        delete_resource_depot(active_depot_id, setup_db, mock_admin)
    assert exc.value.status_code == 400
