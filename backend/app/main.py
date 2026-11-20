from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import PROJECT_NAME, VERSION, DESCRIPTION, UPLOADS_DIR
from app.core.database import init_db
from app.api.v1.router import api_router
from seed_data import seed_database

app = FastAPI(
    title=PROJECT_NAME,
    version=VERSION,
    description=DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Frontend React Client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    """Ensure database schema is verified and initial Chennai dataset is loaded."""
    init_db()
    seed_database()

@app.get("/api/health", tags=["System Health"])
def health_check():
    return {
        "status": "HEALTHY",
        "service": PROJECT_NAME,
        "version": VERSION,
        "modules_active": [
            "Module 1: AI-Based Disaster Intelligence and Severity Prediction",
            "Module 2: Intelligent Emergency Decision Support and Resource Optimization",
            "Module 3: Disaster Monitoring and Visualization"
        ],
        "disclaimer": "Academic Capstone Prototype - Simulated Data Only"
    }

# Mount modular REST APIs
app.include_router(api_router, prefix="/api")

# Mount disaster incident evidence photos directory
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Mount built frontend static files if available
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Don't intercept API routes or documentation
        if full_path.startswith("api") or full_path in ["docs", "redoc", "openapi.json"]:
            return None
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
