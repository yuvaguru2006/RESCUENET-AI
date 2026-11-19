from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Incident Schemas (Module 1) ---

class IncidentCreate(BaseModel):
    title: str = Field(..., examples=["Velachery Lowland Inundation"])
    disaster_type: str = Field(..., examples=["Flood"], description="Flood, Cyclone, Earthquake, Wildfire, Landslide, Building Collapse")
    latitude: float = Field(..., examples=[12.9750])
    longitude: float = Field(..., examples=[80.2207])
    location_name: str = Field(..., examples=["Velachery, Chennai"])
    casualties: int = Field(0, ge=0, examples=[12])
    affected_population: int = Field(0, ge=0, examples=[4500])
    damage_level: int = Field(1, ge=1, le=5, examples=[4], description="Infrastructure Damage on 1-5 scale")
    weather_condition: Optional[str] = Field("Severe Rain", examples=["Heavy Monsoon Rainfall"])

class IncidentPredictionRequest(BaseModel):
    disaster_type: str = Field(..., examples=["Flood"])
    casualties: int = Field(..., ge=0, examples=[15])
    affected_population: int = Field(..., ge=0, examples=[5000])
    damage_level: int = Field(..., ge=1, le=5, examples=[4])
    weather_condition: Optional[str] = "Severe Rain"

class IncidentPredictionResponse(BaseModel):
    severity_level: str = Field(..., examples=["Critical"])
    risk_score: float = Field(..., examples=[89.5], description="Continuous risk metric from 0 to 100")
    confidence: float = Field(..., examples=[0.92])
    class_probabilities: Dict[str, float]
    feature_contributions: Dict[str, float]
    explanation: str
    is_simulated_model: bool = Field(False, description="Trained Scikit-learn model inference")

class IncidentResponse(BaseModel):
    id: int
    title: str
    disaster_type: str
    latitude: float
    longitude: float
    location_name: str
    casualties: int
    affected_population: int
    damage_level: int
    weather_condition: Optional[str]
    severity_level: str
    risk_score: float
    prediction_explanation: Optional[str]
    status: str
    created_at: str

# --- Resource & Allocation Schemas (Module 2) ---

class ResourceDepot(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    ambulances: int
    rescue_teams: int
    boats: int
    supplies: int
    available_ambulances: int
    available_rescue_teams: int
    available_boats: int
    available_supplies: int

class AllocationItem(BaseModel):
    id: int
    incident_id: int
    incident_title: str
    severity_level: str
    depot_id: int
    depot_name: str
    allocated_ambulances: int
    allocated_rescue_teams: int
    allocated_boats: int
    allocated_supplies: int
    distance_km: float
    status: str
    approved_by_human: bool
    created_at: str

class OptimizationResult(BaseModel):
    status: str
    message: str
    allocations_count: int
    allocations: List[AllocationItem]
    unmet_demand: Dict[str, Dict[str, int]]
    depot_stock_remaining: List[Dict[str, Any]]
    solver_execution_time_ms: float

class RecommendationItem(BaseModel):
    incident_id: int
    incident_title: str
    severity_level: str
    recommended_actions: List[str]
    required_resources: Dict[str, int]
    triage_priority: str
    human_approval_required: bool = True

class ApprovalRequest(BaseModel):
    allocation_ids: List[int]
    approved: bool = True
    commander_notes: Optional[str] = "Approved by Emergency Command"

# --- Monitoring & Alerts Schemas (Module 3) ---

class EmergencyAlert(BaseModel):
    id: int
    incident_id: int
    alert_level: str
    headline: str
    message: str
    is_active: bool
    created_at: str

class DashboardSummary(BaseModel):
    active_incidents: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    total_casualties: int
    total_affected_population: int
    total_ambulances_deployed: int
    total_rescue_teams_deployed: int
    total_boats_deployed: int
    total_supplies_deployed: int
    total_ambulances_available: int
    total_rescue_teams_available: int
    total_boats_available: int
    total_supplies_available: int
