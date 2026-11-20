import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { disasterApi } from './api/client';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { SeverityBadge } from './components/common/SeverityBadge';
import { AlertBanner } from './components/module3/AlertBanner';
import {
  AlertTriangle,
  Users,
  ShieldAlert,
  Truck,
  Activity,
  Flame,
  LifeBuoy,
} from 'lucide-react';

// Lazy-loaded components for optimal bundle splitting
const DisasterMap = lazy(() => import('./components/module3/DisasterMap'));
const IncidentRegistrationForm = lazy(() => import('./components/module1/IncidentRegistrationForm'));
const OptimizationConsole = lazy(() => import('./components/module2/OptimizationConsole'));
const AnalyticsVisualizer = lazy(() => import('./components/module3/AnalyticsVisualizer'));
const CitizenDashboard = lazy(() => import('./components/citizen/CitizenDashboard'));
const CitizenReportsReview = lazy(() => import('./components/admin/CitizenReportsReview'));
const AuthModal = lazy(() => import('./components/auth/AuthModal'));

// Command-center skeleton loaders for lazy-loaded modules
const ComponentLoader = ({ label = 'Loading operational module...' }) => (
  <div className="w-full p-12 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center font-mono text-xs text-slate-400 gap-3 shadow-xl">
    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    <span>{label}</span>
  </div>
);

const MapSkeleton = () => (
  <div className="w-full h-[520px] rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-slate-400 gap-3 shadow-2xl">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    <span>Initializing Chennai GIS Telemetry & Spatial Engine...</span>
  </div>
);

export function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Authentication & Role-Based Access State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rescuenet_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('rescuenet_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u.role === 'ADMIN' ? 'admin' : 'citizen';
      }
    } catch {}
    return 'admin';
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Core Data States
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [depots, setDepots] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [mapTelemetry, setMapTelemetry] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  const fetchAllData = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    try {
      // 1. Health check
      try {
        await disasterApi.checkHealth();
        setBackendHealthy(true);
      } catch {
        setBackendHealthy(false);
      }

      // 2. Fetch parallel endpoints
      const [
        summaryRes,
        alertsRes,
        incidentsRes,
        depotsRes,
        allocationsRes,
        mapRes,
        analyticsRes,
      ] = await Promise.allSettled([
        disasterApi.getDashboardSummary(),
        disasterApi.getAlerts(),
        disasterApi.getIncidents(),
        disasterApi.getDepots(),
        disasterApi.getAllocations(),
        disasterApi.getMapTelemetry(),
        disasterApi.getAnalyticsData(),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data);
      if (incidentsRes.status === 'fulfilled') setIncidents(incidentsRes.value.data);
      if (depotsRes.status === 'fulfilled') setDepots(depotsRes.value.data);
      if (allocationsRes.status === 'fulfilled') setAllocations(allocationsRes.value.data);
      if (mapRes.status === 'fulfilled') setMapTelemetry(mapRes.value.data);
      if (analyticsRes.status === 'fulfilled') setAnalyticsData(analyticsRes.value.data);
    } catch (err) {
      console.error('Data sync error', err);
    } finally {
      if (isManual) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Asynchronously trigger initial sync to avoid synchronous setState during mount
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchAllData(false);
      }
    });

    const interval = setInterval(() => {
      if (isMounted) {
        fetchAllData(false);
      }
    }, 15000); // Polling every 15s for live updates

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchAllData]);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'ADMIN') {
      setViewMode('admin');
    } else {
      setViewMode('citizen');
    }
    fetchAllData(false);
  };

  const handleLogout = async () => {
    try {
      await disasterApi.logout();
    } catch (e) {
      console.error('Logout failed', e);
    }
    localStorage.removeItem('rescuenet_token');
    localStorage.removeItem('rescuenet_user');
    setCurrentUser(null);
    setViewMode('admin');
    fetchAllData(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Universal Command Navbar */}
      <Navbar
        backendHealthy={backendHealthy}
        onRefresh={() => fetchAllData(true)}
        refreshing={refreshing}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        viewMode={viewMode}
        onSwitchView={() => setViewMode((prev) => (prev === 'admin' ? 'citizen' : 'admin'))}
      />

      {/* VIEW MODE 1: CITIZEN INTERFACE */}
      {viewMode === 'citizen' ? (
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6">
          {/* Top Ticker: Active Emergency Alerts */}
          <AlertBanner alerts={alerts} onAlertDismissed={fetchAllData} />

          {/* Citizen Dashboard Component */}
          <Suspense fallback={<ComponentLoader label="Loading Citizen Disaster & SOS Portal..." />}>
            <CitizenDashboard
              user={currentUser}
              alerts={alerts}
              onReportSubmitted={() => fetchAllData(false)}
            />
          </Suspense>
        </main>
      ) : (
        /* VIEW MODE 2: ADMINISTRATOR COMMAND-CENTER DASHBOARD */
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Navigation Sidebar */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeAlertsCount={alerts.length}
            activeIncidentsCount={incidents.length}
          />

          {/* Content Area */}
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-6">
            {/* Top Ticker: Active Emergency Alerts */}
            <AlertBanner alerts={alerts} onAlertDismissed={fetchAllData} />

            {/* TAB 1: OVERVIEW & COMMAND MAP */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Executive Operational KPI Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>ACTIVE HAZARDS</span>
                      <Flame className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-100">
                      {summary?.active_incidents || 0}
                    </div>
                    <div className="text-[10px] text-red-400 mt-0.5">
                      {summary?.critical_count || 0} Critical Triage
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>CASUALTIES</span>
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-2xl font-extrabold text-red-400">
                      {summary?.total_casualties || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Reported Victims</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>POPULATION</span>
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-extrabold text-blue-400">
                      {(summary?.total_affected_population || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Exposed Civilians</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>AMBULANCES</span>
                      <Truck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-extrabold text-emerald-400">
                      {summary?.total_ambulances_deployed || 0}{' '}
                      <span className="text-xs text-slate-500 font-normal">
                        /{ (summary?.total_ambulances_deployed || 0) + (summary?.total_ambulances_available || 0) }
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Fleet Deployed</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>RESCUE TEAMS</span>
                      <ShieldAlert className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-extrabold text-purple-400">
                      {summary?.total_rescue_teams_deployed || 0}{' '}
                      <span className="text-xs text-slate-500 font-normal">
                        /{ (summary?.total_rescue_teams_deployed || 0) + (summary?.total_rescue_teams_available || 0) }
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Teams Dispatched</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>RESCUE BOATS</span>
                      <LifeBuoy className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="text-2xl font-extrabold text-cyan-400">
                      {summary?.total_boats_deployed || 0}{' '}
                      <span className="text-xs text-slate-500 font-normal">
                        /{ (summary?.total_boats_deployed || 0) + (summary?.total_boats_available || 0) }
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Marine Vessels</div>
                  </div>
                </div>

                {/* Main Interactive Leaflet Chennai Situation Map */}
                <Suspense fallback={<MapSkeleton />}>
                  <DisasterMap mapTelemetry={mapTelemetry} />
                </Suspense>

                {/* Active Incident Summary Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl font-mono text-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      Active Registered Chennai Incidents
                    </h3>
                    <button
                      onClick={() => setActiveTab('module1')}
                      className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                    >
                      + Register New Incident (Module 1)
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">INCIDENT TITLE</th>
                          <th className="p-3">LOCATION</th>
                          <th className="p-3">TYPE</th>
                          <th className="p-3">SEVERITY</th>
                          <th className="p-3">RISK SCORE</th>
                          <th className="p-3">CASUALTIES</th>
                          <th className="p-3">DAMAGE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {incidents.map((inc) => (
                          <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-3 text-slate-500">#{inc.id}</td>
                            <td className="p-3 font-bold text-slate-100">{inc.title}</td>
                            <td className="p-3 text-slate-400">{inc.location_name}</td>
                            <td className="p-3">{inc.disaster_type}</td>
                            <td className="p-3">
                              <SeverityBadge severity={inc.severity_level} size="sm" />
                            </td>
                            <td className="p-3 font-bold text-slate-200">{inc.risk_score}/100</td>
                            <td className="p-3 text-red-400 font-bold">{inc.casualties}</td>
                            <td className="p-3 text-amber-400">L{inc.damage_level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MODULE 1 - AI DISASTER INTELLIGENCE */}
            {activeTab === 'module1' && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-400 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block text-sm">
                      MODULE 1: AI-BASED DISASTER INTELLIGENCE & SEVERITY PREDICTION
                    </span>
                    <span>
                      Review citizen submissions, ingest official telemetry, and classify severity via Scikit-learn Random Forest.
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-blue-950 text-blue-400 border border-blue-800">
                    ML PIPELINE ACTIVE
                  </span>
                </div>

                {/* Citizen Submissions Review Panel for Incident Commanders */}
                <Suspense fallback={<ComponentLoader label="Loading Citizen Submissions Queue..." />}>
                  <CitizenReportsReview onStatusUpdated={fetchAllData} />
                </Suspense>

                {/* Official Incident Intake Form with Real-Time ML Preview */}
                <Suspense fallback={<ComponentLoader label="Loading Module 1: AI Disaster Intelligence Intake..." />}>
                  <IncidentRegistrationForm onIncidentRegistered={fetchAllData} />
                </Suspense>

                {/* Registered Incidents Directory */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl font-mono text-xs">
                  <h4 className="font-bold text-sm text-slate-100 mb-3 pb-2 border-b border-slate-800">
                    Registered Incident Audit Log (SQLite Database)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">ID</th>
                          <th className="p-2.5">TITLE & LOCATION</th>
                          <th className="p-2.5">WEATHER</th>
                          <th className="p-2.5">AI SEVERITY</th>
                          <th className="p-2.5">RISK INDEX</th>
                          <th className="p-2.5">CASUALTIES</th>
                          <th className="p-2.5">EXPLANATION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {incidents.map((inc) => (
                          <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-2.5 text-slate-500">#{inc.id}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-100">{inc.title}</div>
                              <div className="text-[10px] text-slate-400">{inc.location_name}</div>
                            </td>
                            <td className="p-2.5 text-slate-400">{inc.weather_condition || 'Normal'}</td>
                            <td className="p-2.5">
                              <SeverityBadge severity={inc.severity_level} size="sm" />
                            </td>
                            <td className="p-2.5 font-bold text-slate-200">{inc.risk_score}</td>
                            <td className="p-2.5 text-red-400 font-bold">{inc.casualties}</td>
                            <td className="p-2.5 text-[11px] text-slate-400 max-w-xs truncate">
                              {inc.prediction_explanation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MODULE 2 - DECISION SUPPORT & RESOURCE OPTIMIZATION */}
            {activeTab === 'module2' && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-400 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block text-sm">
                      MODULE 2: INTELLIGENT EMERGENCY DECISION SUPPORT & RESOURCE OPTIMIZATION
                    </span>
                    <span>
                      Capacitated Multi-Depot Resource Allocation via Google OR-Tools CBC MIP Solver with mandatory Human-in-the-Loop Dispatch Approval.
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-purple-950 text-purple-400 border border-purple-800">
                    OR-TOOLS MIP SOLVER
                  </span>
                </div>

                <Suspense fallback={<ComponentLoader label="Loading Module 2: OR-Tools Optimization Engine..." />}>
                  <OptimizationConsole
                    depots={depots}
                    allocations={allocations}
                    onOptimizationRun={fetchAllData}
                    onDispatchApproved={fetchAllData}
                  />
                </Suspense>
              </div>
            )}

            {/* TAB 4: MODULE 3 - MONITORING, VISUALIZATION & REPORTS */}
            {activeTab === 'module3' && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-400 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block text-sm">
                      MODULE 3: DISASTER MONITORING, VISUALIZATION & EXECUTIVE REPORTING
                    </span>
                    <span>
                      Interactive Plotly data visualizations, severity breakdown, and official Emergency Operations Center debrief reports.
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-400 border border-amber-800">
                    PLOTLY ANALYTICS ENGINE
                  </span>
                </div>

                {/* Visual Analytics */}
                <Suspense fallback={<ComponentLoader label="Loading Module 3: Plotly Analytics & Situation Debrief Engine..." />}>
                  <AnalyticsVisualizer analyticsData={analyticsData} summary={summary} />
                </Suspense>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Global Role-Based Authentication Modal */}
      <Suspense fallback={null}>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </Suspense>
    </div>
  );
}

export default App;
