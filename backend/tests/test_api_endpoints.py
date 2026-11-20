import os
os.environ["TESTING"] = "1"

import pytest
from fastapi import HTTPException
from app.core.database import get_connection, init_db
from app.schemas.pydantic_schemas import (
    IncidentCreate,
    ApprovalRequest,
    UserRegister,
    UserLogin,
    CitizenReportCreate,
    SOSRequest,
    IncidentStatusUpdate
)
from app.api.v1.auth import register_citizen, login
from app.api.v1.module1_intelligence import (
    register_incident,
    list_incidents,
    report_citizen_incident,
    trigger_sos_emergency,
    get_my_reports,
    update_incident_status
)
from app.api.v1.module2_decision import run_optimization, list_allocations, approve_dispatch
from app.api.v1.module3_monitoring import get_dashboard_summary, get_map_telemetry, get_analytics_data
from seed_data import seed_database

@pytest.fixture(scope="module")
def setup_db():
    init_db()
    seed_database(force_reset=True)
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

def test_duplicate_incident_registration_updates_existing_record(setup_db):
    """Verifies that re-registering an incident with identical title updates telemetry instead of duplicating."""
    payload1 = IncidentCreate(
        title="Koyambedu Wholesale Market Flood",
        disaster_type="Flood",
        latitude=13.0694,
        longitude=80.1948,
        location_name="Koyambedu, Chennai",
        casualties=4,
        affected_population=1800,
        damage_level=2,
        weather_condition="Moderate Rain"
    )
    res1 = register_incident(payload1, setup_db)
    id1 = res1["id"]

    # Re-register with same title but updated casualties & damage
    payload2 = IncidentCreate(
        title="Koyambedu Wholesale Market Flood",
        disaster_type="Flood",
        latitude=13.0694,
        longitude=80.1948,
        location_name="Koyambedu, Chennai",
        casualties=18,
        affected_population=4500,
        damage_level=4,
        weather_condition="Severe Rain"
    )
    res2 = register_incident(payload2, setup_db)
    id2 = res2["id"]

    # Must be the same ID, updated values, no duplicate record
    assert id1 == id2
    assert res2["casualties"] == 18
    assert res2["affected_population"] == 4500
    assert res2["damage_level"] == 4

    cursor = setup_db.cursor()
    cursor.execute("SELECT COUNT(*) FROM incidents WHERE LOWER(title) = LOWER(?);", ("Koyambedu Wholesale Market Flood",))
    count = cursor.fetchone()[0]
    assert count == 1

def test_dispatch_approval_requires_commander_notes(setup_db):
    """Verifies that dispatching without explicit commander notes or empty allocations is rejected."""
    with pytest.raises(HTTPException) as excinfo:
        approve_dispatch(
            ApprovalRequest(allocation_ids=[1], approved=True, commander_notes="   "),
            setup_db
        )
    assert excinfo.value.status_code == 400
    assert "commander authorization notes" in excinfo.value.detail.lower()

    with pytest.raises(HTTPException) as excinfo2:
        approve_dispatch(
            ApprovalRequest(allocation_ids=[], approved=True, commander_notes="Authorized"),
            setup_db
        )
    assert excinfo2.value.status_code == 400
    assert "at least one allocation" in excinfo2.value.detail.lower()

def test_resource_inventory_and_deployment_totals_consistency(setup_db):
    """Verifies that deployed + available inventory equals total depot capacity across all resource types."""
    summary = get_dashboard_summary(setup_db)
    cursor = setup_db.cursor()
    cursor.execute("""
    SELECT 
        SUM(ambulances) as total_amb,
        SUM(rescue_teams) as total_teams,
        SUM(boats) as total_boats,
        SUM(supplies) as total_sup
    FROM resource_depots;
    """)
    totals = cursor.fetchone()
    
    assert summary["total_ambulances_deployed"] + summary["total_ambulances_available"] == totals["total_amb"]
    assert summary["total_rescue_teams_deployed"] + summary["total_rescue_teams_available"] == totals["total_teams"]
    assert summary["total_boats_deployed"] + summary["total_boats_available"] == totals["total_boats"]
    assert summary["total_supplies_deployed"] + summary["total_supplies_available"] == totals["total_sup"]

def test_citizen_registration_and_login_rbac(setup_db):
    """Verifies citizen registration unconditionally sets role CITIZEN and login returns valid token."""
    reg_payload = UserRegister(
        username="muthu_kumar",
        email="muthu@chennai.gov",
        password="Password123!",
        full_name="Muthu Kumar",
        phone="+91 98840 99999"
    )
    reg_res = register_citizen(reg_payload, setup_db)
    assert reg_res["token"]
    assert reg_res["user"]["role"] == "CITIZEN"
    assert reg_res["user"]["username"] == "muthu_kumar"

    # Verify duplicate username rejected
    with pytest.raises(HTTPException) as exc:
        register_citizen(reg_payload, setup_db)
    assert exc.value.status_code == 400

    # Test login
    login_payload = UserLogin(username="muthu_kumar", password="Password123!")
    login_res = login(login_payload, setup_db)
    assert login_res["token"]
    assert login_res["user"]["role"] == "CITIZEN"

    # Test seeded admin login
    admin_login = UserLogin(username="admin", password="Admin@123")
    admin_res = login(admin_login, setup_db)
    assert admin_res["token"]
    assert admin_res["user"]["role"] == "ADMIN"

def test_citizen_report_with_rf_prediction_and_my_reports(setup_db):
    """Verifies that citizen reports trigger RF severity prediction and show up in my-reports."""
    mock_citizen = {
        "user_id": 2,
        "username": "citizen",
        "full_name": "Kavitha Ramanathan",
        "role": "CITIZEN"
    }

    report_payload = CitizenReportCreate(
        disaster_type="Flood",
        location_name="T. Nagar South Usman Road",
        latitude=13.0400,
        longitude=80.2300,
        description="Water stagnation over 3 feet near commercial complex, ground floor submerged.",
        casualties=2,
        affected_population=1200,
        damage_level=3
    )

    incident = report_citizen_incident(report_payload, mock_citizen, setup_db)
    assert incident["id"] > 0
    assert incident["source"] == "CITIZEN"
    assert incident["status"] == "Reported"
    assert incident["severity_level"] in ["Medium", "High", "Critical"]
    assert incident["risk_score"] > 0.0

    # Check my-reports
    my_reports = get_my_reports(mock_citizen, setup_db)
    assert len(my_reports) > 0
    assert any(r["id"] == incident["id"] for r in my_reports)

def test_citizen_sos_emergency_distress(setup_db):
    """Verifies that citizen SOS creates an instant Critical emergency incident."""
    mock_citizen = {
        "user_id": 2,
        "username": "citizen",
        "full_name": "Kavitha Ramanathan",
        "role": "CITIZEN"
    }
    sos_payload = SOSRequest(
        latitude=13.0100,
        longitude=80.2500,
        location_name="Adyar Bridge Flood Triage",
        phone="+91 98401 23456",
        note="Family trapped on second floor due to rapid river swelling"
    )
    sos_res = trigger_sos_emergency(sos_payload, mock_citizen, setup_db)
    assert sos_res["is_sos"] == 1
    assert sos_res["severity_level"] == "Critical"
    assert sos_res["risk_score"] >= 95.0
    assert sos_res["status"] == "Reported"

def test_admin_update_incident_status(setup_db):
    """Verifies that admin can update incident status to Verified or Resolved."""
    mock_admin = {
        "user_id": 1,
        "username": "admin",
        "full_name": "State Incident Commander",
        "role": "ADMIN"
    }
    # Update incident 1 status to Verified
    update_res = update_incident_status(
        1,
        IncidentStatusUpdate(status="Verified", commander_notes="Ground team confirmed visual sighting"),
        setup_db,
        mock_admin
    )
    assert update_res["success"] is True
    assert update_res["status"] == "Verified"

def test_citizen_forbidden_from_admin_solve(setup_db):
    """Verifies that citizen role cannot execute optimization solver."""
    mock_citizen = {
        "user_id": 2,
        "username": "citizen",
        "role": "CITIZEN"
    }
    with pytest.raises(HTTPException) as exc:
        run_optimization(setup_db, mock_citizen)
    assert exc.value.status_code == 403

def test_citizen_forbidden_from_admin_dispatch_approval(setup_db):
    """Verifies that citizen role cannot approve dispatch."""
    mock_citizen = {
        "user_id": 2,
        "username": "citizen",
        "role": "CITIZEN"
    }
    with pytest.raises(HTTPException) as exc:
        approve_dispatch(
            ApprovalRequest(allocation_ids=[1], approved=True, commander_notes="Attempted by citizen"),
            setup_db,
            mock_citizen
        )
    assert exc.value.status_code == 403
