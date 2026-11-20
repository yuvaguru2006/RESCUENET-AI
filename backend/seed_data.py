import sys
import argparse
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.core.database import init_db, get_db_context
from app.ml.predictor import predictor

def seed_database(force_reset: bool = False):
    """Initializes tables and seeds initial Chennai disaster depots and simulated incidents."""
    init_db()
    
    with get_db_context() as conn:
        cursor = conn.cursor()
        
        if force_reset:
            print("Force resetting database tables and state...")
            cursor.execute("DELETE FROM emergency_alerts;")
            cursor.execute("DELETE FROM allocations;")
            cursor.execute("DELETE FROM incidents;")
            cursor.execute("DELETE FROM resource_depots;")
            try:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('emergency_alerts', 'allocations', 'incidents', 'resource_depots');")
            except Exception:
                pass
            conn.commit()
        else:
            # Check if already seeded
            cursor.execute("SELECT COUNT(*) FROM resource_depots;")
            if cursor.fetchone()[0] > 0:
                print("Database already contains resource depots. Skipping re-seed.")
                return

        print("Seeding Chennai Emergency Resource Depots...")
        depots = [
            ("Chennai Central EOC Depot (Egmore)", 13.0827, 80.2707, 25, 15, 10, 300),
            ("South Chennai Emergency Base (Guindy)", 13.0067, 80.2026, 20, 12, 18, 250),
            ("North Chennai Coastal Station (Royapuram)", 13.1147, 80.2941, 15, 10, 14, 200),
            ("Tambaram Regional Defense Facility", 12.9249, 80.1000, 18, 10, 8, 220),
            ("Anna Nagar Civil Protection Hub", 13.0850, 80.2101, 15, 8, 6, 180)
        ]

        for name, lat, lon, amb, teams, boats, sup in depots:
            cursor.execute("""
            INSERT INTO resource_depots (
                name, latitude, longitude,
                ambulances, rescue_teams, boats, supplies,
                available_ambulances, available_rescue_teams, available_boats, available_supplies
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (name, lat, lon, amb, teams, boats, sup, amb, teams, boats, sup))

        print("Seeding Initial Simulated Chennai Disaster Incidents with genuine ML scoring...")
        initial_incidents = [
            {
                "title": "Velachery Lowland Storm Inundation",
                "disaster_type": "Flood",
                "latitude": 12.9750,
                "longitude": 80.2207,
                "location_name": "Velachery, Chennai",
                "casualties": 14,
                "affected_population": 4800,
                "damage_level": 4,
                "weather_condition": "Severe Rain",
                "status": "Active"
            },
            {
                "title": "Marina Beach Cyclone Storm Surge",
                "disaster_type": "Cyclone",
                "latitude": 13.0500,
                "longitude": 80.2824,
                "location_name": "Marina Coastal Strip, Chennai",
                "casualties": 6,
                "affected_population": 2900,
                "damage_level": 3,
                "weather_condition": "Storm Winds",
                "status": "Active"
            },
            {
                "title": "George Town Commercial Structure Collapse",
                "disaster_type": "Building Collapse",
                "latitude": 13.0900,
                "longitude": 80.2860,
                "location_name": "Parrys / George Town, Chennai",
                "casualties": 22,
                "affected_population": 850,
                "damage_level": 5,
                "weather_condition": "Normal",
                "status": "Active"
            },
            {
                "title": "Tambaram West Inundation & Substation Flooding",
                "disaster_type": "Flood",
                "latitude": 12.9300,
                "longitude": 80.1200,
                "location_name": "Tambaram West, Chennai",
                "casualties": 2,
                "affected_population": 1100,
                "damage_level": 2,
                "weather_condition": "Moderate Rain",
                "status": "Active"
            },
            {
                "title": "Adyar Riverbank Breach & Residential Flooding",
                "disaster_type": "Flood",
                "latitude": 13.0100,
                "longitude": 80.2500,
                "location_name": "Kotturpuram / Adyar, Chennai",
                "casualties": 8,
                "affected_population": 3400,
                "damage_level": 3,
                "weather_condition": "Monsoon Surge",
                "status": "Active"
            }
        ]

        for inc in initial_incidents:
            # Run genuine ML inference
            ml_result = predictor.predict(inc)
            sev = ml_result["severity_level"]
            score = ml_result["risk_score"]
            explanation = ml_result["explanation"]

            cursor.execute("""
            INSERT INTO incidents (
                title, disaster_type, latitude, longitude, location_name,
                casualties, affected_population, damage_level, weather_condition,
                severity_level, risk_score, prediction_explanation, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                inc["title"], inc["disaster_type"], inc["latitude"], inc["longitude"],
                inc["location_name"], inc["casualties"], inc["affected_population"],
                inc["damage_level"], inc["weather_condition"], sev, score, explanation, inc["status"]
            ))
            incident_id = cursor.lastrowid

            # Create emergency alert if severity is High or Critical
            if sev in ["Critical", "High"]:
                cursor.execute("""
                INSERT INTO emergency_alerts (
                    incident_id, alert_level, headline, message, is_active
                ) VALUES (?, ?, ?, ?, 1);
                """, (
                    incident_id,
                    sev,
                    f"CRITICAL DISASTER ALERT: {inc['title']}",
                    f"{sev.upper()} SEVERITY DETECTED: {inc['location_name']}. Reported casualties: {inc['casualties']}. Risk Score: {score}/100. Emergency deployment protocol initiated."
                ))

        print(f"Successfully seeded 5 resource depots and {len(initial_incidents)} simulated Chennai incidents.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed database for RESCUENET AI")
    parser.add_argument("--reset", action="store_true", help="Force reset and purge all tables before seeding")
    args = parser.parse_args()
    seed_database(force_reset=args.reset)
