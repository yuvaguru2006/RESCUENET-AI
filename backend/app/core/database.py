import sqlite3
from contextlib import contextmanager
from typing import Generator
from app.core.config import DB_PATH

def get_connection() -> sqlite3.Connection:
    """Creates and returns a SQLite connection configured for WAL mode and dict rows."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db_context() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for transactional database operations."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_db():
    """FastAPI dependency for database connection."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initializes database tables according to system specifications."""
    with get_db_context() as conn:
        cursor = conn.cursor()
        
        # 1. Incidents Table (Module 1)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            disaster_type TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            location_name TEXT NOT NULL,
            casualties INTEGER NOT NULL DEFAULT 0,
            affected_population INTEGER NOT NULL DEFAULT 0,
            damage_level INTEGER NOT NULL DEFAULT 1,
            weather_condition TEXT DEFAULT 'Normal',
            severity_level TEXT NOT NULL,
            risk_score REAL NOT NULL,
            prediction_explanation TEXT,
            status TEXT NOT NULL DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Resource Depots Table (Module 2)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resource_depots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            ambulances INTEGER NOT NULL DEFAULT 0,
            rescue_teams INTEGER NOT NULL DEFAULT 0,
            boats INTEGER NOT NULL DEFAULT 0,
            supplies INTEGER NOT NULL DEFAULT 0,
            available_ambulances INTEGER NOT NULL DEFAULT 0,
            available_rescue_teams INTEGER NOT NULL DEFAULT 0,
            available_boats INTEGER NOT NULL DEFAULT 0,
            available_supplies INTEGER NOT NULL DEFAULT 0
        );
        """)

        # 3. Allocations Table (Module 2)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            depot_id INTEGER NOT NULL,
            allocated_ambulances INTEGER NOT NULL DEFAULT 0,
            allocated_rescue_teams INTEGER NOT NULL DEFAULT 0,
            allocated_boats INTEGER NOT NULL DEFAULT 0,
            allocated_supplies INTEGER NOT NULL DEFAULT 0,
            distance_km REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'Proposed',
            approved_by_human INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE,
            FOREIGN KEY (depot_id) REFERENCES resource_depots (id) ON DELETE CASCADE
        );
        """)

        # 4. Emergency Alerts Table (Module 3)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS emergency_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            alert_level TEXT NOT NULL,
            headline TEXT NOT NULL,
            message TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE CASCADE
        );
        """)
