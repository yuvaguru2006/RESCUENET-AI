import pytest
from app.core.database import get_connection, init_db
from app.schemas.pydantic_schemas import IncidentCreate, ApprovalRequest
from app.api.v1.module1_intelligence import register_incident, list_incidents
from app.api.v1.module2_decision import run_optimization, list_allocations, approve_dispatch
from app.api.v1.module3_monitoring import get_dashboard_summary, get_map_telemetry, get_analytics_data
from seed_data import seed_database

@pytest.fixture(scope="module")
def setup_db():
    init_db()
    seed_database()
    conn = get_connection()
    yield conn
    conn.close()

def test_register_incident_endpoint(setup_db):
    """Tests registering a new incident via endpoint function and verifying ML classification."""
    payload = IncidentCreate(
        title="Royapuram Harbor Tidal Surge",
        disaster_type="Cyclone",
        latitude=13.1150,
        longitude=80.2950,
        location_name="Royapuram Harbor, Chennai",
        casualties=16,
        affected_population=5200,
        damage_level=4,
        weather_condition="Storm Winds"
    )
    result = register_incident(payload, setup_db)
    assert result["id"] > 0
    assert result["title"] == "Royapuram Harbor Tidal Surge"
    assert result["severity_level"] in ["High", "Critical"]
    assert result["risk_score"] > 60.0

def test_list_incidents_endpoint(setup_db):
    """Tests listing incidents from database."""
    incidents = list_incidents(severity=None, status=None, conn=setup_db)
    assert len(incidents) >= 5

def test_run_optimization_and_approval_workflow(setup_db):
    """Tests full Module 2 workflow: running OR-Tools solver then human approval."""
    opt_result = run_optimization(setup_db)
    assert opt_result["status"] in ["OPTIMAL", "FEASIBLE"]
    assert len(opt_result["allocations"]) > 0
    
    # Check allocations listed
    allocations = list_allocations(status=None, conn=setup_db)
    assert len(allocations) > 0
    
    # Initially all newly generated allocations must be PROPOSED (not dispatched)
    proposed_allocs = [a for a in allocations if a["status"] == "Proposed"]
    assert len(proposed_allocs) > 0
    
    # Test human approval on the first allocation
    target_alloc_id = proposed_allocs[0]["id"]
    approval_payload = ApprovalRequest(
        allocation_ids=[target_alloc_id],
        approved=True,
        commander_notes="Approved by Chief Operations Officer"
    )
    approval_res = approve_dispatch(approval_payload, setup_db)
    assert approval_res["success"] is True
    assert approval_res["approved_count"] == 1
    
    # Verify allocation status changed to Dispatched
    cursor = setup_db.cursor()
    cursor.execute("SELECT status, approved_by_human FROM allocations WHERE id = ?;", (target_alloc_id,))
    row = cursor.fetchone()
    assert row["status"] == "Dispatched"
    assert row["approved_by_human"] == 1

def test_rerun_optimization_does_not_duplicate_dispatched_or_double_consume(setup_db):
    """
    Verifies that re-running optimization:
    1. Preserves existing Dispatched records without deleting them.
    2. Takes into account already dispatched assets to avoid duplicate allocations.
    3. Re-approving an already dispatched allocation does not double decrement inventory.
    """
    cursor = setup_db.cursor()
    
    # Count existing Dispatched allocations before re-run
    cursor.execute("SELECT COUNT(*), id, depot_id, allocated_ambulances FROM allocations WHERE status = 'Dispatched';")
    disp_row = cursor.fetchone()
    initial_dispatched_count = disp_row[0]
    sample_dispatched_id = disp_row[1]
    sample_depot_id = disp_row[2]

    # Check depot inventory before
    cursor.execute("SELECT available_ambulances FROM resource_depots WHERE id = ?;", (sample_depot_id,))
    stock_before = cursor.fetchone()["available_ambulances"]

    # Re-run optimization
    opt_result_2 = run_optimization(setup_db)
    assert opt_result_2["status"] in ["OPTIMAL", "FEASIBLE"]

    # Check that previous Dispatched allocations still exist
    cursor.execute("SELECT COUNT(*) FROM allocations WHERE status = 'Dispatched';")
    dispatched_count_after = cursor.fetchone()[0]
    assert dispatched_count_after == initial_dispatched_count

    # Try re-approving the same dispatched allocation
    re_approve_payload = ApprovalRequest(
        allocation_ids=[sample_dispatched_id],
        approved=True,
        commander_notes="Attempted duplicate approval"
    )
    re_res = approve_dispatch(re_approve_payload, setup_db)
    # Should approve 0 because it's already dispatched
    assert re_res["approved_count"] == 0

    # Stock must NOT have decreased
    cursor.execute("SELECT available_ambulances FROM resource_depots WHERE id = ?;", (sample_depot_id,))
    stock_after = cursor.fetchone()["available_ambulances"]
    assert stock_after == stock_before

def test_monitoring_telemetry_and_analytics(setup_db):
    """Tests Module 3 summary, map telemetry, and analytics queries."""
    summary = get_dashboard_summary(setup_db)
    assert summary["active_incidents"] > 0
    
    map_data = get_map_telemetry(setup_db)
    assert len(map_data["incidents"]) > 0
    assert len(map_data["depots"]) == 5
    
    analytics = get_analytics_data(setup_db)
    assert "severity_distribution" in analytics
    assert "hazard_type_breakdown" in analytics
