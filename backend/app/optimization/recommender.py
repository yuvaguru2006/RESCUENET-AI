from typing import Dict, Any, List
from app.optimization.solver import calculate_resource_demand

class EmergencyRecommender:
    """
    Generates standard operating procedures (SOPs), triage recommendations,
    and resource requirement summaries for emergency command officers.
    """
    @staticmethod
    def get_recommendation(incident: Dict[str, Any]) -> Dict[str, Any]:
        disaster_type = incident.get("disaster_type", "Flood")
        severity = incident.get("severity_level", "Medium")
        casualties = int(incident.get("casualties", 0))
        damage = int(incident.get("damage_level", 1))
        
        required_resources = calculate_resource_demand(incident)
        actions: List[str] = []

        # Triage determination
        if severity == "Critical":
            triage_priority = "PRIORITY 1: IMMEDIATE LIFE-SAVING INTERVENTION"
            actions.append("Establish Incident Command Post (ICP) within 1 km safe perimeter.")
            actions.append("Initiate Mass Casualty Incident (MCI) triage protocol at receiving district hospitals.")
            actions.append("Activate mutual aid agreements with adjacent regional civil defense battalions.")
        elif severity == "High":
            triage_priority = "PRIORITY 2: RAPID TACTICAL DEPLOYMENT"
            actions.append("Deploy rapid search-and-rescue teams to designated high-density subsectors.")
            actions.append("Issue automated emergency evacuation broadcast across municipal cell towers.")
        elif severity == "Medium":
            triage_priority = "PRIORITY 3: CONTAINMENT & STABILIZATION"
            actions.append("Deploy reconnaissance teams to verify reported damage and coordinate local logistics.")
            actions.append("Stage regional ambulance and first responder units at staging zone.")
        else:
            triage_priority = "PRIORITY 4: ROUTINE MONITORING & RELIEF"
            actions.append("Maintain situational awareness and provide basic humanitarian supply distribution.")

        # Hazard-specific protocols
        if disaster_type == "Flood":
            actions.append(f"Deploy shallow-draft motorized boats to low-lying subzones; prioritize stranded civilians.")
            actions.append("Coordinate with irrigation & drainage authorities for floodgate monitoring.")
        elif disaster_type == "Cyclone":
            actions.append("Clear arterial evacuation routes of fallen trees and downed electrical lines.")
            actions.append("Secure emergency generator fuel at critical healthcare facilities.")
        elif disaster_type in ["Earthquake", "Building Collapse"]:
            actions.append(f"Deploy structural collapse rescue specialists with acoustic listening devices and shoring gear.")
            actions.append("Isolate natural gas mains and high-voltage power grids in affected perimeter.")
        elif disaster_type == "Wildfire":
            actions.append("Establish firebreak perimeters and mobilize water tankers along residential buffer zones.")
            actions.append("Distribute N95/particulate respirators to shelter sites.")

        return {
            "incident_id": incident.get("id", 0),
            "incident_title": incident.get("title", "Disaster Incident"),
            "severity_level": severity,
            "triage_priority": triage_priority,
            "required_resources": required_resources,
            "recommended_actions": actions,
            "human_approval_required": True,
            "advisory_note": "AI recommendations provide decision support only. Field deployment requires operational approval by Incident Commander."
        }
