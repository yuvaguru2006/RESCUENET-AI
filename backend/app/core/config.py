import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
APP_DIR = BASE_DIR / "app"
DATA_DIR = BASE_DIR / "data"
ML_ARTIFACTS_DIR = APP_DIR / "ml" / "artifacts"

DATA_DIR.mkdir(parents=True, exist_ok=True)
ML_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# Database
DB_PATH = DATA_DIR / "rescuenet.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Project Metadata
PROJECT_NAME = "RESCUENET AI"
VERSION = "1.0.0"
DESCRIPTION = "AI-Driven Disaster Intelligence, Emergency Decision Support, and Resource Optimization Platform"

# Chennai Geographic Center for Context
DEFAULT_MAP_CENTER = {"lat": 13.0827, "lng": 80.2707, "zoom": 11}
