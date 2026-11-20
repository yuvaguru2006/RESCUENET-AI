import React, { useState } from 'react';
import { disasterApi } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import { Truck, CheckCircle2, AlertOctagon, Play, ShieldAlert, FileText, XCircle } from 'lucide-react';

export const OptimizationConsole = ({ depots, allocations, onOptimizationRun, onDispatchApproved }) => {
  const [running, setRunning] = useState(false);
  const [solverResult, setSolverResult] = useState(null);
  const [selectedAllocations, setSelectedAllocations] = useState([]);
  const [commanderNotes, setCommanderNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [selectedIncidentRecommendation, setSelectedIncidentRecommendation] = useState(null);

  const handleRunOptimizer = async () => {
    try {
      setRunning(true);
      const res = await disasterApi.solveOptimization();
      setSolverResult(res.data);
      if (onOptimizationRun) {
        onOptimizationRun();
      }
      // Require explicit human operator selection — do NOT auto-select
      setSelectedAllocations([]);
    } catch (err) {
      console.error('Optimization run failed', err);
    } finally {
      setRunning(false);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedAllocations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllProposed = () => {
    const proposed = allocations.filter((a) => a.status === 'Proposed').map((a) => a.id);
    setSelectedAllocations(proposed);
  };

  const handleApproveDispatch = async () => {
    if (selectedAllocations.length === 0 || !commanderNotes.trim()) return;
    try {
      setApproving(true);
      await disasterApi.approveDispatch(selectedAllocations, commanderNotes.trim());
      setSelectedAllocations([]);
      setCommanderNotes('');
      if (onDispatchApproved) {
        onDispatchApproved();
      }
    } catch (err) {
      console.error('Dispatch approval failed', err);
    } finally {
      setApproving(false);
    }
  };

  const handleViewRecommendation = async (incidentId) => {
    try {
      const res = await disasterApi.getRecommendations(incidentId);
      setSelectedIncidentRecommendation(res.data);
    } catch (err) {
      console.error('Failed to load recommendation', err);
    }
  };

  const proposedCount = allocations.filter((a) => a.status === 'Proposed').length;

  return (
    <div className="space-y-6">
      {/* Depots Inventory Status Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
            <Truck className="w-4 h-4 text-blue-400" />
            Regional Emergency Resource Depots (Live Inventory)
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {depots.length} DEPOTS READY ACROSS CHENNAI REGION
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {depots.map((depot) => (
            <div
              key={depot.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs shadow-md"
            >
              <div className="font-bold text-slate-200 truncate mb-2 text-[11px] pb-1 border-b border-slate-800">
                🏢 {depot.name}
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ambulances:</span>
                  <span className="font-bold text-blue-400">{depot.available_ambulances} <span className="text-slate-600 font-normal">/{depot.ambulances}</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rescue Teams:</span>
                  <span className="font-bold text-emerald-400">{depot.available_rescue_teams} <span className="text-slate-600 font-normal">/{depot.rescue_teams}</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rescue Boats:</span>
                  <span className="font-bold text-cyan-400">{depot.available_boats} <span className="text-slate-600 font-normal">/{depot.boats}</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Relief Packs:</span>
                  <span className="font-bold text-amber-400">{depot.available_supplies} <span className="text-slate-600 font-normal">/{depot.supplies}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Solver Action Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-800/40 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
            <Truck className="w-5 h-5 text-purple-400" />
            Google OR-Tools Mathematical Optimization Engine
          </h4>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Formulates Mixed-Integer Linear Program (MILP) minimizing response transit distance while heavily penalizing unmet demand at critical triage zones.
          </p>
        </div>
        <button
          onClick={handleRunOptimizer}
          disabled={running}
          className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold py-2.5 px-6 rounded-lg font-mono text-xs flex items-center gap-2 shadow-lg shadow-purple-950/60 transition disabled:opacity-50 shrink-0"
        >
          <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'SOLVING OR-TOOLS MIP...' : 'EXECUTE RESOURCE OPTIMIZER'}</span>
        </button>
      </div>

      {/* Solver Execution Stats */}
      {solverResult && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono flex flex-wrap items-center justify-between gap-3 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">SOLVER STATUS:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
              {solverResult.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">SOLVE TIME:</span>
            <span className="text-purple-400 font-bold">{solverResult.solver_execution_time_ms} ms</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">NEW PROPOSALS:</span>
            <span className="text-blue-400 font-bold">{solverResult.allocations_count} Dispatches</span>
          </div>
          {Object.keys(solverResult.unmet_demand || {}).length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertOctagon className="w-4 h-4" />
              <span>UNMET DEMAND DETECTED (Depot Scarcity)</span>
            </div>
          )}
        </div>
      )}

      {/* Human-in-the-Loop Approval Operations Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Human-in-the-Loop Operational Dispatch Approval
            </h4>
            <p className="text-xs text-slate-400 font-mono">
              Proposed allocations require explicit incident commander verification before field dispatch orders are transmitted.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllProposed}
              className="text-xs font-mono text-blue-400 hover:text-blue-300 bg-slate-950 px-2.5 py-1 rounded border border-slate-800"
            >
              Select All Proposed ({proposedCount})
            </button>
          </div>
        </div>

        {/* Commander Sign-Off Notes */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 font-mono text-xs">
          <div className="md:col-span-8">
            <label className="block text-slate-400 mb-1 flex items-center justify-between">
              <span>COMMANDER DISPATCH LOG / NOTES (MANDATORY HUMAN SIGN-OFF):</span>
              {!commanderNotes.trim() && (
                <span className="text-amber-400 text-[10px] font-bold">AWAITING OPERATOR INPUT</span>
              )}
            </label>
            <input
              type="text"
              placeholder="Enter official authorization notes (e.g., Authorized by State Incident Commander for immediate deployment)..."
              value={commanderNotes}
              onChange={(e) => setCommanderNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
            />
          </div>
          <div className="md:col-span-4 flex items-end">
            <button
              onClick={handleApproveDispatch}
              disabled={approving || selectedAllocations.length === 0 || !commanderNotes.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {approving
                  ? 'AUTHORIZING FIELD ORDERS...'
                  : selectedAllocations.length === 0
                  ? 'SELECT ALLOCATIONS TO DISPATCH'
                  : !commanderNotes.trim()
                  ? 'ENTER COMMANDER NOTES'
                  : `AUTHORIZE & DISPATCH (${selectedAllocations.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-3 w-10 text-center">SELECT</th>
                <th className="p-3">TARGET INCIDENT</th>
                <th className="p-3">SEVERITY</th>
                <th className="p-3">ORIGIN DEPOT</th>
                <th className="p-3 text-center">ALLOCATED ASSETS</th>
                <th className="p-3">TRANSIT</th>
                <th className="p-3">STATUS</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    No active resource allocations yet. Click "EXECUTE RESOURCE OPTIMIZER" above.
                  </td>
                </tr>
              ) : (
                allocations.map((alloc) => {
                  const isSelected = selectedAllocations.includes(alloc.id);
                  const isDispatched = alloc.status === 'Dispatched';
                  return (
                    <tr
                      key={alloc.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isSelected ? 'bg-slate-800/60' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDispatched}
                          onChange={() => handleToggleSelect(alloc.id)}
                          className="accent-emerald-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="p-3 font-semibold text-slate-100">
                        {alloc.incident_title}
                      </td>
                      <td className="p-3">
                        <SeverityBadge severity={alloc.severity_level} size="sm" />
                      </td>
                      <td className="p-3 text-blue-400">
                        {alloc.depot_name}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                          <span title="Ambulances">🚑 {alloc.allocated_ambulances}</span>
                          <span title="Rescue Teams">👷 {alloc.allocated_rescue_teams}</span>
                          <span title="Rescue Boats">🚤 {alloc.allocated_boats}</span>
                          <span title="Relief Supplies">📦 {alloc.allocated_supplies}</span>
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {alloc.distance_km.toFixed(1)} km
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isDispatched
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : 'bg-purple-950/80 text-purple-400 border-purple-800'
                          }`}
                        >
                          {alloc.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleViewRecommendation(alloc.incident_id)}
                          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700"
                        >
                          SOP Brief
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Emergency Tactical SOP Modal */}
      {selectedIncidentRecommendation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl font-mono text-xs text-slate-300 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  Tactical Emergency Standard Operating Procedure (SOP)
                </h4>
              </div>
              <button
                onClick={() => setSelectedIncidentRecommendation(null)}
                className="text-slate-400 hover:text-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-slate-500 block uppercase">INCIDENT TITLE:</span>
                <span className="text-base font-bold text-slate-100">
                  {selectedIncidentRecommendation.incident_title}
                </span>
              </div>

              <div className="p-2.5 bg-red-950/60 border border-red-800/80 rounded-md text-red-300 font-bold">
                {selectedIncidentRecommendation.triage_priority}
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  ESTIMATED MINIMUM RESOURCE REQUIREMENTS:
                </span>
                <div className="grid grid-cols-4 gap-2 text-center bg-slate-950 p-2 rounded border border-slate-800">
                  <div>🚑 Amb: <b className="text-slate-100">{selectedIncidentRecommendation.required_resources.ambulances}</b></div>
                  <div>👷 Teams: <b className="text-slate-100">{selectedIncidentRecommendation.required_resources.rescue_teams}</b></div>
                  <div>🚤 Boats: <b className="text-slate-100">{selectedIncidentRecommendation.required_resources.boats}</b></div>
                  <div>📦 Supplies: <b className="text-slate-100">{selectedIncidentRecommendation.required_resources.supplies}</b></div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1">TACTICAL DIRECTIVES:</span>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
                  {selectedIncidentRecommendation.recommended_actions.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-slate-400 italic">
                {selectedIncidentRecommendation.advisory_note}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedIncidentRecommendation(null)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-md"
              >
                Acknowledge Directive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationConsole;
