# RESCUENET AI: AI-Driven Disaster Intelligence, Emergency Decision Support, and Resource Optimization Platform

[![Python](https://img.shields.io/badge/Python-3.14-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Scikit--Learn](https://img.shields.io/badge/Scikit--Learn-Random_Forest-F7931E.svg)](https://scikit-learn.org/)
[![OR--Tools](https://img.shields.io/badge/Google-OR--Tools_MIP-4285F4.svg)](https://developers.google.com/optimization)
[![Tests](https://img.shields.io/badge/Pytest-10_Passed-success.svg)](https://pytest.org/)

> **Academic Capstone Project — CSA10 Software Engineering**  
> *Demonstrating Agile SDLC, Requirements Engineering, Modular Architecture, Full-Stack Development, Machine Learning, Mathematical Optimization, and Responsible AI.*

---

## ⚠️ Academic Prototype & Responsible AI Disclaimer
RESCUENET AI is an academic software engineering capstone prototype. All disaster telemetries, geospatial incidents, and resource inventories are simulated for the Greater Chennai metropolitan area to evaluate computational methods. Predictions and optimization outputs serve strictly as **decision-support recommendations**; field operations mandate **human-in-the-loop (HITL) approval** by an incident commander prior to physical dispatch.

---

## 🏛️ System Architecture & The Exactly Three Modules

RESCUENET AI is engineered with a strict 3-tier, decoupled software architecture ensuring high maintainability and testability.

```
                              ┌─────────────────────────────────────────┐
                              │       PRESENTATION LAYER (CLIENT)       │
                              │ React.js + Tailwind CSS + Leaflet.js    │
                              │           + Plotly.js Visualizer        │
                              └────────────────────┬────────────────────┘
                                                   │ REST / JSON (port 8000)
                                                   ▼
                              ┌─────────────────────────────────────────┐
                              │        APPLICATION / API LAYER          │
                              │          FastAPI REST Router            │
                              │     Pydantic v2 Schema Validation       │
                              └───────┬────────────┬────────────┬───────┘
                                      │            │            │
            ┌─────────────────────────┘            │            └─────────────────────────┐
            ▼                                      ▼                                      ▼
┌───────────────────────┐              ┌───────────────────────┐              ┌───────────────────────┐
│       MODULE 1        │              │       MODULE 2        │              │       MODULE 3        │
│ Disaster Intelligence │              │   Decision Support    │              │ Monitoring & Analysis │
│  & Severity Predict   │              │   & Optimization      │              │  Dashboard & GIS Map  │
│                       │              │                       │              │                       │
│ • Incident Ingest     │              │ • Demand Calculation  │              │ • Interactive Map     │
│ • Scikit-learn RF     │              │ • Google OR-Tools MIP │              │ • Alert Broadcasting  │
│ • Risk Score & XAI    │              │ • HITL Dispatch Auth  │              │ • Plotly Analytics    │
│ • SQLite Incident DB  │              │ • Tactical SOP Briefs │              │ • Situation Debriefs  │
└───────────┬───────────┘              └───────────┬───────────┘              └───────────┬───────────┘
            │                                      │                                      │
            └──────────────────────────────────────┼──────────────────────────────────────┘
                                                   ▼
                              ┌─────────────────────────────────────────┐
                              │            PERSISTENCE LAYER            │
                              │       SQLite3 (WAL Mode, ACID)          │
                              │    + Serialized joblib ML Pipeline      │
                              └─────────────────────────────────────────┘
```

### Module 1: AI-Based Disaster Intelligence & Severity Prediction
- **Telemetry Ingest**: Captures disaster type, location, casualties count, affected population, infrastructure damage rating (1–5), and weather metrics.
- **Genuine Machine Learning**: Evaluates incidents using a trained Scikit-learn `RandomForestClassifier` (150 estimators, ColumnTransformer with standard scaling and one-hot encoding).
- **Triage Classification**: Outputs discrete severity (`Low`, `Medium`, `High`, `Critical`).
- **Continuous Risk Metric**: Computes a continuous Risk Index ($0$ to $100$) weighted across model class probabilities.
- **Explainable AI (XAI)**: Generates human-readable factor contribution breakdowns explaining why an event received its classification.

### Module 2: Intelligent Emergency Decision Support & Resource Optimization
- **Dynamic Demand Estimation**: Computes required ambulances, search-and-rescue teams, evacuation boats, and relief packs based on hazard type, casualties, and severity.
- **Google OR-Tools Mixed-Integer Programming (MIP)**: Solves a capacitated multi-depot transportation problem minimizing transit distance while heavily penalizing unmet demand at critical disaster zones.
- **Resource Inventory Management**: Tracks real-time vehicle and personnel stocks across regional Chennai depots.
- **Human-in-the-Loop Approval**: Proposed allocations require explicit review and sign-off by an incident commander before orders are committed to database inventory.
- **Emergency Action Recommendations (SOPs)**: Produces disaster-specific tactical directives and hospital triage notifications.

### Module 3: Disaster Monitoring & Visualization
- **Emergency Operations Dashboard**: High-contrast, dark navy command-center interface displaying active hazard counters, casualties, and fleet utilization.
- **Interactive Leaflet GIS Map**: Renders simulated Chennai disaster locations with pulsing severity indicators, resource depots, and dispatch vectors.
- **Emergency Alert Broadcast**: High-visibility ticker for critical triage escalations with manual acknowledgment.
- **Plotly.js Data Analytics**: Interactive charts for severity distribution, hazard casualties breakdown, depot utilization, and exportable EOC debrief reports.

---

## 📁 Project Directory Structure

```
RESCUENET-AI/
├── backend/
│   ├── app/
│   │   ├── api/v1/                     # Modular REST Routers
│   │   │   ├── module1_intelligence.py # Incident registration & ML endpoints
│   │   │   ├── module2_decision.py     # OR-Tools solver & dispatch endpoints
│   │   │   ├── module3_monitoring.py   # GIS telemetry, alerts & analytics
│   │   │   └── router.py               # Combined API v1 router
│   │   ├── core/                       # Core configuration & SQLite database
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── ml/                         # Scikit-learn ML Pipeline
│   │   │   ├── artifacts/              # Serialized Random Forest model
│   │   │   ├── predictor.py            # Inference & Explainable AI wrapper
│   │   │   └── train.py                # Dataset generator & training pipeline
│   │   ├── optimization/               # Google OR-Tools Engine
│   │   │   ├── solver.py               # Capacitated MIP solver
│   │   │   └── recommender.py          # Tactical SOP generator
│   │   ├── schemas/                    # Pydantic v2 schemas
│   │   │   └── pydantic_schemas.py
│   │   └── main.py                     # FastAPI application & SPA static server
│   ├── tests/                          # Automated Pytest Suite
│   │   ├── test_api_endpoints.py       # Full-stack API integration tests
│   │   ├── test_ml_model.py            # ML inference & bounds tests
│   │   └── test_optimization.py        # OR-Tools constraint satisfaction tests
│   ├── seed_data.py                    # Chennai depots & incident seeder
│   └── requirements.txt                # Python backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── api/client.js               # Axios REST client
│   │   ├── components/
│   │   │   ├── common/                 # Navbar, Sidebar, SeverityBadge
│   │   │   ├── module1/                # Incident Registration Form & ML Preview
│   │   │   ├── module2/                # OR-Tools Optimization Console & Dispatch Approval
│   │   │   └── module3/                # Leaflet Map, Plotly Charts & Alert Banner
│   │   ├── App.jsx                     # Core application orchestrator
│   │   ├── index.css                   # Tailwind styles & Leaflet rules
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md                           # Documentation & execution instructions
```

---

## 🚀 Setup & Execution Instructions

### Prerequisites
- **Python**: Version 3.10 or higher (Tested on Python 3.14)
- **Node.js**: Version 18 or higher (Tested on Node.js v24 & npm 11)
- **Git**

---

### Step 1: Install Backend Dependencies & Train Model
Open a terminal in the project root:

```bash
cd backend
pip install -r requirements.txt
python app/ml/train.py
python seed_data.py
```

---

### Step 2: Build the Frontend Client
In a separate terminal or after Step 1:

```bash
cd frontend
npm install
npm run build
```

---

### Step 3: Run the Complete RESCUENET AI Platform

#### Mode A: Unified Single-Port Execution (Recommended)
FastAPI serves both the complete REST API and the compiled React frontend client on a single port:

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- **Web Dashboard**: Open [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Endpoint**: Open [http://localhost:8000/api/health](http://localhost:8000/api/health)

#### Mode B: Independent Development Mode (Hot-Reloading)
Run backend and frontend concurrently in two terminals:

```bash
# Terminal 1: Backend API
cd backend
python -m uvicorn app.main:app --port 8000 --reload

# Terminal 2: React Vite Dev Server
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Automated Testing & Verification

Run the automated test suite covering all three modules:

```bash
cd backend
python -m pytest tests -v
```

### Test Coverage Highlights
- `test_ml_model.py`: Validates Random Forest inference, ensures high casualties/damage trigger Critical/High severity, verifies risk score bounds $[0, 100]$, and checks XAI feature contribution sums.
- `test_optimization.py`: Verifies Haversine distance calculations, ensures OR-Tools MIP solver strictly enforces depot capacity constraints, and confirms graceful handling of inventory scarcity.
- `test_api_endpoints.py`: Tests incident registration, ML scoring persistence, optimization trigger, human-in-the-loop dispatch approvals, and GIS telemetry queries.

---

## 📊 Software Engineering Principles Applied (CSA10 Alignment)
1. **Agile SDLC**: Timeboxed sprints delivering functional increments from data engine to full-stack dashboard.
2. **Modular Architecture**: Complete separation of business rules, ML pipelines, optimization models, and presentation components.
3. **Robust REST Design**: Standard HTTP status codes, structured JSON schemas, and clear routing conventions.
4. **Data Integrity**: SQLite configured with Foreign Key constraints and atomic transactions for inventory deductions.
5. **Quality Assurance**: Automated regression tests validating mathematical constraints and machine learning bounds.
6. **Responsible AI**: Continuous explainability metrics and mandatory human authorization before operational dispatch.
