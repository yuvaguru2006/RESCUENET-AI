import pytest
from app.optimization.solver import ResourceOptimizationSolver, haversine_distance_km

@pytest.fixture
def solver_instance():
    return ResourceOptimizationSolver()

def test_haversine_distance():
    # Distance between Chennai Egmore (13.0827, 80.2707) and Guindy (13.0067, 80.2026) is approx 11-12 km
    dist = haversine_distance_km(13.0827, 80.2707, 13.0067, 80.2026)
    assert 10.0 <= dist <= 14.0

def test_or_tools_solver_capacity_constraints(solver_instance):
    """Verifies that OR-Tools solver never allocates more resources than available in depots."""
    incidents = [
        {
            "id": 1,
            "title": "Severe Coastal Surge",
            "disaster_type": "Flood",
            "latitude": 13.0400,
            "longitude": 80.2500,
            "casualties": 15,
            "affected_population": 4000,
            "damage_level": 4,
            "severity_level": "Critical"
        }
    ]
    
    depots = [
        {
            "id": 101,
            "name": "North Depot",
            "latitude": 13.0900,
            "longitude": 80.2800,
            "available_ambulances": 5,
            "available_rescue_teams": 3,
            "available_boats": 4,
            "available_supplies": 50
        }
    ]
    
    result = solver_instance.solve(incidents, depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]
    assert result["solver_execution_time_ms"] < 1000.0
    
    # Check that allocations do not exceed available limits
    allocated_amb = sum(a["allocated_ambulances"] for a in result["allocations"])
    allocated_boats = sum(a["allocated_boats"] for a in result["allocations"])
    
    assert allocated_amb <= 5
    assert allocated_boats <= 4

def test_solver_handles_resource_scarcity_gracefully(solver_instance):
    """Verifies that when demand exceeds capacity, unmet demand is calculated without crashing."""
    incidents = [
        {
            "id": 2,
            "title": "Massive Earthquake",
            "disaster_type": "Earthquake",
            "latitude": 13.0500,
            "longitude": 80.2400,
            "casualties": 80,
            "affected_population": 25000,
            "damage_level": 5,
            "severity_level": "Critical"
        }
    ]
    
    # Very limited depot inventory
    depots = [
        {
            "id": 102,
            "name": "Depleted Station",
            "latitude": 13.0500,
            "longitude": 80.2400,
            "available_ambulances": 1,
            "available_rescue_teams": 1,
            "available_boats": 0,
            "available_supplies": 5
        }
    ]
    
    result = solver_instance.solve(incidents, depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]
    # Unmet demand should be recorded
    unmet = result["unmet_demand"]
    assert len(unmet) > 0
