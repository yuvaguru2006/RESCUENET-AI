import math
import time
from typing import List, Dict, Any, Tuple
from ortools.linear_solver import pywraplp

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0 # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def calculate_resource_demand(incident: Dict[str, Any]) -> Dict[str, int]:
    """
    Computes required emergency resources based on disaster type, casualties,
    affected population, damage level, and ML severity classification.
    """
    disaster_type = incident.get("disaster_type", "Flood")
    severity = incident.get("severity_level", "Medium")
    casualties = int(incident.get("casualties", 0))
    pop = int(incident.get("affected_population", 0))
    damage = int(incident.get("damage_level", 1))

    # Base multipliers by severity
    severity_multipliers = {
        "Critical": 3.0,
        "High": 2.0,
        "Medium": 1.2,
        "Low": 0.8
    }
    mult = severity_multipliers.get(severity, 1.2)

    # Base requirements by hazard type
    if disaster_type == "Flood":
        base_amb = max(2, casualties // 3 + 1)
        base_teams = 3 + damage
        base_boats = 4 + (2 if pop > 3000 else 1)
        base_supplies = max(20, pop // 200)
    elif disaster_type == "Cyclone":
        base_amb = max(3, casualties // 3 + 2)
        base_teams = 4 + damage
        base_boats = 2 if pop > 2000 else 1
        base_supplies = max(30, pop // 150)
    elif disaster_type in ["Earthquake", "Building Collapse"]:
        base_amb = max(4, casualties // 2 + 2)
        base_teams = 5 + (damage * 2)
        base_boats = 0
        base_supplies = max(25, pop // 180)
    elif disaster_type == "Wildfire":
        base_amb = max(3, casualties // 3 + 1)
        base_teams = 4 + damage
        base_boats = 0
        base_supplies = max(15, pop // 250)
    else: # Landslide or general
        base_amb = max(2, casualties // 3 + 1)
        base_teams = 3 + damage
        base_boats = 0
        base_supplies = max(15, pop // 200)

    return {
        "ambulances": max(1, int(round(base_amb * mult))),
        "rescue_teams": max(1, int(round(base_teams * mult))),
        "boats": int(round(base_boats * mult)),
        "supplies": max(5, int(round(base_supplies * mult)))
    }

class ResourceOptimizationSolver:
    """
    Google OR-Tools Mixed-Integer Programming (MIP) Solver for
    Capacitated Multi-Depot Disaster Emergency Resource Allocation.
    """
    def __init__(self):
        self.resources = ["ambulances", "rescue_teams", "boats", "supplies"]
        self.severity_weights = {
            "Critical": 10.0,
            "High": 5.0,
            "Medium": 2.0,
            "Low": 1.0
        }

    def solve(
        self,
        incidents: List[Dict[str, Any]],
        depots: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Executes Google OR-Tools CBC solver to find the optimal allocation matrix.
        """
        start_time = time.perf_counter()

        if not incidents:
            return {
                "status": "NO_INCIDENTS",
                "message": "No active incidents requiring allocation.",
                "allocations": [],
                "unmet_demand": {},
                "depot_stock_remaining": depots,
                "solver_execution_time_ms": 0.0
            }

        if not depots:
            return {
                "status": "NO_DEPOTS",
                "message": "No resource depots available.",
                "allocations": [],
                "unmet_demand": {},
                "depot_stock_remaining": [],
                "solver_execution_time_ms": 0.0
            }

        # Initialize OR-Tools MIP Solver
        solver = pywraplp.Solver.CreateSolver("CBC")
        if not solver:
            # Fallback to GLOP/SCIP if CBC is not initialized
            solver = pywraplp.Solver.CreateSolver("SCIP")
        if not solver:
            solver = pywraplp.Solver.CreateSolver("GLOP")

        # Calculate distances and demands
        distances: Dict[Tuple[int, int], float] = {}
        demands: Dict[int, Dict[str, int]] = {}

        for inc in incidents:
            inc_id = inc["id"]
            demands[inc_id] = calculate_resource_demand(inc)
            for dep in depots:
                dep_id = dep["id"]
                dist = haversine_distance_km(
                    dep["latitude"], dep["longitude"],
                    inc["latitude"], inc["longitude"]
                )
                distances[(inc_id, dep_id)] = max(0.5, dist) # Minimum 0.5 km to prevent divide by zero

        # Create Decision Variables: X[inc_id, dep_id, resource]
        X: Dict[Tuple[int, int, str], Any] = {}
        for inc in incidents:
            inc_id = inc["id"]
            for dep in depots:
                dep_id = dep["id"]
                for r in self.resources:
                    cap = dep.get(f"available_{r}", dep.get(r, 0))
                    # Upper bound cannot exceed depot available stock
                    X[(inc_id, dep_id, r)] = solver.IntVar(0, max(0, cap), f"X_{inc_id}_{dep_id}_{r}")

        # Slack Variables for Unmet Demand: U[inc_id, resource]
        U: Dict[Tuple[int, str], Any] = {}
        for inc in incidents:
            inc_id = inc["id"]
            for r in self.resources:
                req = demands[inc_id][r]
                U[(inc_id, r)] = solver.IntVar(0, req, f"U_{inc_id}_{r}")

        # 1. Capacity Constraints: sum_inc(X) <= Depot Capacity
        for dep in depots:
            dep_id = dep["id"]
            for r in self.resources:
                cap = dep.get(f"available_{r}", dep.get(r, 0))
                solver.Add(
                    solver.Sum([X[(inc["id"], dep_id, r)] for inc in incidents]) <= cap
                )

        # 2. Demand Balance Constraints: sum_dep(X) + U == Demand
        for inc in incidents:
            inc_id = inc["id"]
            for r in self.resources:
                req = demands[inc_id][r]
                solver.Add(
                    solver.Sum([X[(inc_id, dep["id"], r)] for dep in depots]) + U[(inc_id, r)] >= req
                )

        # 3. Objective Function:
        # Minimize (Transit Distance * Allocations) + Severe Penalty * Severity Weight * Unmet Demand
        objective = solver.Objective()
        for inc in incidents:
            inc_id = inc["id"]
            weight = self.severity_weights.get(inc.get("severity_level", "Medium"), 2.0)
            
            for dep in depots:
                dep_id = dep["id"]
                dist = distances[(inc_id, dep_id)]
                for r in self.resources:
                    # Resource travel cost scale
                    res_cost = 1.0 if r == "supplies" else 2.5
                    objective.SetCoefficient(X[(inc_id, dep_id, r)], dist * res_cost)

            for r in self.resources:
                # Heavy penalty for unmet demand, scaled by severity
                unmet_penalty = 1500.0 * weight
                objective.SetCoefficient(U[(inc_id, r)], unmet_penalty)

        objective.SetMinimization()

        # Solve
        solver_status = solver.Solve()
        exec_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        is_optimal = solver_status in [pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE]

        allocations = []
        unmet_demand_report = {}
        depot_stock_tracker = {dep["id"]: {r: dep.get(f"available_{r}", dep.get(r, 0)) for r in self.resources} for dep in depots}

        if is_optimal:
            for inc in incidents:
                inc_id = inc["id"]
                unmet_demand_report[inc["title"]] = {}
                
                # Check unmet demand
                for r in self.resources:
                    unmet_val = int(round(U[(inc_id, r)].solution_value()))
                    if unmet_val > 0:
                        unmet_demand_report[inc["title"]][r] = unmet_val

                # Collect non-zero dispatch allocations
                for dep in depots:
                    dep_id = dep["id"]
                    alloc_amb = int(round(X[(inc_id, dep_id, "ambulances")].solution_value()))
                    alloc_teams = int(round(X[(inc_id, dep_id, "rescue_teams")].solution_value()))
                    alloc_boats = int(round(X[(inc_id, dep_id, "boats")].solution_value()))
                    alloc_sup = int(round(X[(inc_id, dep_id, "supplies")].solution_value()))

                    if alloc_amb > 0 or alloc_teams > 0 or alloc_boats > 0 or alloc_sup > 0:
                        allocations.append({
                            "incident_id": inc_id,
                            "incident_title": inc["title"],
                            "severity_level": inc.get("severity_level", "Medium"),
                            "depot_id": dep_id,
                            "depot_name": dep["name"],
                            "allocated_ambulances": alloc_amb,
                            "allocated_rescue_teams": alloc_teams,
                            "allocated_boats": alloc_boats,
                            "allocated_supplies": alloc_sup,
                            "distance_km": distances[(inc_id, dep_id)],
                            "status": "Proposed",
                            "approved_by_human": False
                        })
                        
                        # Deduct from depot tracker
                        depot_stock_tracker[dep_id]["ambulances"] -= alloc_amb
                        depot_stock_tracker[dep_id]["rescue_teams"] -= alloc_teams
                        depot_stock_tracker[dep_id]["boats"] -= alloc_boats
                        depot_stock_tracker[dep_id]["supplies"] -= alloc_sup

        # Format remaining depot stock
        depot_remaining = []
        for dep in depots:
            dep_id = dep["id"]
            depot_remaining.append({
                "depot_id": dep_id,
                "depot_name": dep["name"],
                "remaining_ambulances": depot_stock_tracker[dep_id]["ambulances"],
                "remaining_rescue_teams": depot_stock_tracker[dep_id]["rescue_teams"],
                "remaining_boats": depot_stock_tracker[dep_id]["boats"],
                "remaining_supplies": depot_stock_tracker[dep_id]["supplies"]
            })

        return {
            "status": "OPTIMAL" if solver_status == pywraplp.Solver.OPTIMAL else "FEASIBLE" if is_optimal else "FAILED",
            "message": "Optimization solved successfully using Google OR-Tools MIP solver." if is_optimal else "Optimization solver could not find a feasible solution.",
            "allocations_count": len(allocations),
            "allocations": allocations,
            "unmet_demand": unmet_demand_report,
            "depot_stock_remaining": depot_remaining,
            "solver_execution_time_ms": exec_time_ms
        }

# Singleton instance
optimization_solver = ResourceOptimizationSolver()
