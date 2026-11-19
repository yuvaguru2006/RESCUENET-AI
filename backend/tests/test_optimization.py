import pytest
from app.optimization.solver import (
    ResourceOptimizationSolver,
    haversine_distance_km,
    calculate_resource_demand
)

@pytest.fixture
def solver_instance():
    return ResourceOptimizationSolver()

def test_haversine_distance():
    # Distance between Chennai Egmore (13.0827, 80.2707) and Guindy (13.0067, 80.2026) is approx 11-12 km
    dist = haversine_distance_km(13.0827, 80.2707, 13.0067, 80.2026)
    assert 10.0 <= dist <= 14.0

def test_total_allocations_never_exceed_demand(solver_instance):
    """
    Constraint 1: Total resources allocated to each incident must not exceed its actual demand,
    even when depots have massive excess inventory.
    """
    incidents = [
        {
            "id": 1,
            "title": "Local Urban Inundation",
            "disaster_type": "Flood",
            "latitude": 13.0400,
            "longitude": 80.2500,
            "casualties": 3,
            "affected_population": 800,
            "damage_level": 2,
            "severity_level": "Medium"
        }
    ]
    gross_demand = calculate_resource_demand(incidents[0])

    # Depots with enormous surplus inventory
    depots = [
        {
            "id": 101,
            "name": "Mega Logistics Hub",
            "latitude": 13.0500,
            "longitude": 80.2500,
            "available_ambulances": 500,
            "available_rescue_teams": 500,
            "available_boats": 500,
            "available_supplies": 5000
        }
    ]

    result = solver_instance.solve(incidents, depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]
    
    total_amb = sum(a["allocated_ambulances"] for a in result["allocations"])
    total_teams = sum(a["allocated_rescue_teams"] for a in result["allocations"])
    total_boats = sum(a["allocated_boats"] for a in result["allocations"])
    total_supplies = sum(a["allocated_supplies"] for a in result["allocations"])

    # Allocations must strictly be <= gross demand (never over-allocate)
    assert total_amb == gross_demand["ambulances"]
    assert total_teams == gross_demand["rescue_teams"]
    assert total_boats == gross_demand["boats"]
    assert total_supplies == gross_demand["supplies"]

def test_combined_depot_allocations_never_exceed_inventory(solver_instance):
    """
    Constraint 2: Combined allocations from a depot must never exceed its available inventory,
    even when multiple incidents compete for scarce inventory.
    """
    incidents = [
        {
            "id": 10,
            "title": "Incident Alpha",
            "disaster_type": "Flood",
            "latitude": 13.0400,
            "longitude": 80.2500,
            "casualties": 30,
            "affected_population": 8000,
            "damage_level": 4,
            "severity_level": "High"
        },
        {
            "id": 11,
            "title": "Incident Beta",
            "disaster_type": "Flood",
            "latitude": 13.0600,
            "longitude": 80.2700,
            "casualties": 25,
            "affected_population": 6000,
            "damage_level": 4,
            "severity_level": "High"
        }
    ]

    # Constrained depot with only 8 ambulances and 6 boats
    depots = [
        {
            "id": 201,
            "name": "Constrained Coastal Base",
            "latitude": 13.0500,
            "longitude": 80.2600,
            "available_ambulances": 8,
            "available_rescue_teams": 10,
            "available_boats": 6,
            "available_supplies": 80
        }
    ]

    result = solver_instance.solve(incidents, depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]

    total_depot_amb = sum(a["allocated_ambulances"] for a in result["allocations"] if a["depot_id"] == 201)
    total_depot_boats = sum(a["allocated_boats"] for a in result["allocations"] if a["depot_id"] == 201)

    assert total_depot_amb <= 8
    assert total_depot_boats <= 6

def test_anti_fragmentation_prefers_single_depot(solver_instance):
    """
    Constraint 3: Prevent duplicate or unnecessary allocation records.
    When a single nearest depot has sufficient stock, the solver should NOT fragment
    the allocation across multiple depots.
    """
    incident = {
        "id": 30,
        "title": "Solitary Disaster",
        "disaster_type": "Building Collapse",
        "latitude": 13.0800,
        "longitude": 80.2700,
        "casualties": 5,
        "affected_population": 500,
        "damage_level": 3,
        "severity_level": "Medium"
    }

    # Depot 1 is very close (0.5 km) and has plenty of stock
    # Depot 2 is farther (10 km) and also has stock
    depots = [
        {
            "id": 301,
            "name": "Nearby Station",
            "latitude": 13.0810,
            "longitude": 80.2710,
            "available_ambulances": 20,
            "available_rescue_teams": 20,
            "available_boats": 20,
            "available_supplies": 200
        },
        {
            "id": 302,
            "name": "Distant Station",
            "latitude": 13.0000,
            "longitude": 80.2000,
            "available_ambulances": 20,
            "available_rescue_teams": 20,
            "available_boats": 20,
            "available_supplies": 200
        }
    ]

    result = solver_instance.solve([incident], depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]

    # Allocations for this incident should come ONLY from the nearby depot (no fragmentation)
    allocating_depots = {a["depot_id"] for a in result["allocations"]}
    assert allocating_depots == {301}
    assert len(result["allocations"]) == 1

def test_unmet_demand_calculated_correctly(solver_instance):
    """
    Constraint 4: Ensure unmet demand is calculated correctly when capacity is insufficient.
    """
    incident = {
        "id": 40,
        "title": "Catastrophic Cyclone Inundation",
        "disaster_type": "Flood",
        "latitude": 13.0400,
        "longitude": 80.2500,
        "casualties": 50,
        "affected_population": 15000,
        "damage_level": 5,
        "severity_level": "Critical"
    }
    demand = calculate_resource_demand(incident)

    # Depot only has 2 ambulances
    depots = [
        {
            "id": 401,
            "name": "Depleted Station",
            "latitude": 13.0400,
            "longitude": 80.2500,
            "available_ambulances": 2,
            "available_rescue_teams": demand["rescue_teams"],
            "available_boats": demand["boats"],
            "available_supplies": demand["supplies"]
        }
    ]

    result = solver_instance.solve([incident], depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]

    allocated_amb = sum(a["allocated_ambulances"] for a in result["allocations"])
    assert allocated_amb == 2

    # Unmet demand for ambulances must equal demand["ambulances"] - 2
    expected_unmet_amb = demand["ambulances"] - 2
    assert result["unmet_demand"][incident["title"]]["ambulances"] == expected_unmet_amb

def test_re_running_optimization_with_dispatched_demand(solver_instance):
    """
    Constraints 5 & 7: Re-running optimization must not duplicate previous dispatch records
    or consume inventory twice.
    """
    incident = {
        "id": 50,
        "title": "Already Dispatched Disaster",
        "disaster_type": "Flood",
        "latitude": 13.0400,
        "longitude": 80.2500,
        "casualties": 10,
        "affected_population": 2000,
        "damage_level": 3,
        "severity_level": "Medium"
    }
    gross = calculate_resource_demand(incident)

    # Simulate that this incident was ALREADY fully dispatched in a previous round
    incident["already_dispatched"] = gross.copy()

    depots = [
        {
            "id": 501,
            "name": "Regional Depot",
            "latitude": 13.0400,
            "longitude": 80.2500,
            "available_ambulances": 50,
            "available_rescue_teams": 50,
            "available_boats": 50,
            "available_supplies": 500
        }
    ]

    # Re-run optimization
    result = solver_instance.solve([incident], depots)
    assert result["status"] == "OPTIMAL"
    # No new allocations should be proposed!
    assert len(result["allocations"]) == 0
    # No unmet demand should be reported!
    assert len(result["unmet_demand"]) == 0

def test_partial_dispatch_only_allocates_remaining_demand(solver_instance):
    """
    When an incident is partially dispatched, re-running optimization only allocates
    the remaining unmet requirement.
    """
    incident = {
        "id": 60,
        "title": "Partially Dispatched Disaster",
        "disaster_type": "Flood",
        "latitude": 13.0400,
        "longitude": 80.2500,
        "casualties": 12,
        "affected_population": 3000,
        "damage_level": 3,
        "severity_level": "High"
    }
    gross = calculate_resource_demand(incident)
    
    # Already dispatched half the ambulances
    disp_amb = gross["ambulances"] // 2
    incident["already_dispatched"] = {
        "ambulances": disp_amb,
        "rescue_teams": gross["rescue_teams"],
        "boats": gross["boats"],
        "supplies": gross["supplies"]
    }

    depots = [
        {
            "id": 601,
            "name": "Regional Hub",
            "latitude": 13.0400,
            "longitude": 80.2500,
            "available_ambulances": 50,
            "available_rescue_teams": 50,
            "available_boats": 50,
            "available_supplies": 500
        }
    ]

    result = solver_instance.solve([incident], depots)
    assert result["status"] in ["OPTIMAL", "FEASIBLE"]
    
    allocated_amb = sum(a["allocated_ambulances"] for a in result["allocations"])
    # Should only allocate remaining ambulances: gross - disp_amb
    assert allocated_amb == (gross["ambulances"] - disp_amb)
    # Rescue teams, boats, supplies should have 0 new allocations
    assert sum(a["allocated_rescue_teams"] for a in result["allocations"]) == 0
    assert sum(a["allocated_boats"] for a in result["allocations"]) == 0
    assert sum(a["allocated_supplies"] for a in result["allocations"]) == 0
