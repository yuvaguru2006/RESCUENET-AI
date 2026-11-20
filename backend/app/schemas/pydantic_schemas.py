from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Authentication & User Schemas (Core RBAC) ---

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, examples=["citizen_chennai"])
    email: str = Field(..., min_length=5, examples=["citizen@rescuenet.gov"])
    password: str = Field(..., min_length=6, examples=["Password123!"])
    full_name: str = Field(..., min_length=2, max_length=100, examples=["Kavitha Ramanathan"])
    phone: Optional[str] = Field(None, examples=["+91 98401 23456"])

class UserLogin(BaseModel):
    username: str = Field(..., examples=["citizen"])
    password: str = Field(..., examples=["Citizen@123"])

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    created_at: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    token_type: str = "Bearer"
    user: UserResponse

# --- Citizen Reporting & SOS Schemas (Module 1 & 3) ---

class CitizenReportCreate(BaseModel):
    title: Optional[str] = None
    disaster_type: str = Field(..., examples=["Flood"], description="Flood, Cyclone, Earthquake, Wildfire, Landslide, Building Collapse")
    location_name: str = Field(..., examples=["Velachery Main Road, Chennai"])
    latitude: float = Field(..., examples=[12.9750])
    longitude: float = Field(..., examples=[80.2207])
    description: str = Field(..., min_length=5, examples=["Water level reached 4 feet. Multiple residents trapped."])
    image_base64: Optional[str] = None
    casualties: int = Field(0, ge=0)
    affected_population: int = Field(0, ge=0)
    damage_level: int = Field(1, ge=1, le=5)
    weather_condition: Optional[str] = "Normal"

class SOSRequest(BaseModel):
    latitude: float = Field(..., examples=[13.0827])
    longitude: float = Field(..., examples=[80.2707])
    location_name: Optional[str] = "Current GPS Coordinates"
    phone: Optional[str] = None
    note: Optional[str] = "Immediate evacuation and medical rescue required!"

class IncidentStatusUpdate(BaseModel):
    status: str = Field(..., examples=["Verified"], description="Reported, Verified, Active, Dispatched, Resolved")
    commander_notes: Optional[str] = None

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
    reporter_id: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_sos: Optional[int] = 0
    source: Optional[str] = "OFFICIAL"
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
    allocated_ambulances: Optional[int] = 0
    allocated_rescue_teams: Optional[int] = 0
    allocated_boats: Optional[int] = 0
    allocated_supplies: Optional[int] = 0

class DepotCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100, examples=["Guindy Emergency Depot"])
    latitude: float = Field(..., examples=[13.0067])
    longitude: float = Field(..., examples=[80.2026])
    ambulances: int = Field(0, ge=0)
    rescue_teams: int = Field(0, ge=0)
    boats: int = Field(0, ge=0)
    supplies: int = Field(0, ge=0, description="Food kits, water supplies and emergency packs")

class DepotUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    ambulances: Optional[int] = Field(None, ge=0)
    rescue_teams: Optional[int] = Field(None, ge=0)
    boats: Optional[int] = Field(None, ge=0)
    supplies: Optional[int] = Field(None, ge=0)
    available_ambulances: Optional[int] = Field(None, ge=0)
    available_rescue_teams: Optional[int] = Field(None, ge=0)
    available_boats: Optional[int] = Field(None, ge=0)
    available_supplies: Optional[int] = Field(None, ge=0)

class IncidentDemandItem(BaseModel):
    incident_id: int
    title: str
    disaster_type: str
    severity_level: str
    risk_score: float
    location_name: str
    latitude: float
    longitude: float
    casualties: int
    affected_population: int
    damage_level: int
    gross_demand: Dict[str, int]
    already_dispatched: Dict[str, int]
    net_demand: Dict[str, int]

class IncidentDemandsResponse(BaseModel):
    total_active_incidents: int
    incidents: List[IncidentDemandItem]
    aggregated_gross_demand: Dict[str, int]
    aggregated_dispatched: Dict[str, int]
    aggregated_net_demand: Dict[str, int]
    total_available_stock: Dict[str, int]
    stock_status: Dict[str, str]

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
    commander_notes: str = Field(..., min_length=3, description="Mandatory human incident commander authorization notes")

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
