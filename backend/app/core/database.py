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
        
        # 0. Users and Session Tokens (Role-Based Access Control)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL CHECK(role IN ('CITIZEN', 'ADMIN')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)

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
            reporter_id INTEGER,
            description TEXT,
            image_url TEXT,
            is_sos INTEGER NOT NULL DEFAULT 0,
            source TEXT NOT NULL DEFAULT 'OFFICIAL',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE SET NULL
        );
        """)

        # Safely ensure migration columns exist if table was already created
        cursor.execute("PRAGMA table_info(incidents);")
        inc_cols = [r[1] for r in cursor.fetchall()]
        if "reporter_id" not in inc_cols:
            cursor.execute("ALTER TABLE incidents ADD COLUMN reporter_id INTEGER;")
        if "description" not in inc_cols:
            cursor.execute("ALTER TABLE incidents ADD COLUMN description TEXT;")
        if "image_url" not in inc_cols:
            cursor.execute("ALTER TABLE incidents ADD COLUMN image_url TEXT;")
        if "is_sos" not in inc_cols:
            cursor.execute("ALTER TABLE incidents ADD COLUMN is_sos INTEGER NOT NULL DEFAULT 0;")
        if "source" not in inc_cols:
            cursor.execute("ALTER TABLE incidents ADD COLUMN source TEXT NOT NULL DEFAULT 'OFFICIAL';")

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
