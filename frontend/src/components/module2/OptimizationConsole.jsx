import React, { useState, useEffect, useCallback } from 'react';
import { disasterApi } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import {
  Truck,
  CheckCircle2,
  AlertOctagon,
  Play,
  ShieldAlert,
  FileText,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  Database,
  Layers,
  ArrowRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export const OptimizationConsole = ({
  depots = [],
  allocations = [],
  onOptimizationRun,
  onDispatchApproved,
  onDepotsChanged
}) => {
  // Navigation Sub-tab within Module 2
  const [activeSubTab, setActiveSubTab] = useState('optimizer'); // 'optimizer' | 'inventory' | 'demands'

  // Optimization & Approval States
  const [running, setRunning] = useState(false);
  const [solverResult, setSolverResult] = useState(null);
  const [selectedAllocations, setSelectedAllocations] = useState([]);
  const [commanderNotes, setCommanderNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [selectedIncidentRecommendation, setSelectedIncidentRecommendation] = useState(null);
  const [transactionFeedback, setTransactionFeedback] = useState(null);

  // Pre-Optimization Incident Demands State
  const [demandsData, setDemandsData] = useState(null);
  const [loadingDemands, setLoadingDemands] = useState(false);

  // Depot Inventory Management States
  const [addDepotModalOpen, setAddDepotModalOpen] = useState(false);
  const [editDepotModalOpen, setEditDepotModalOpen] = useState(false);
  const [selectedDepotForEdit, setSelectedDepotForEdit] = useState(null);
  const [depotFormSaving, setDepotFormSaving] = useState(false);
  const [depotFormError, setDepotFormError] = useState(null);

  // New Depot Form Data
  const [newDepotData, setNewDepotData] = useState({
    name: '',
    latitude: 13.0382,
    longitude: 80.1565,
    ambulances: 15,
    rescue_teams: 10,
    boats: 6,
    supplies: 150
  });

  // Edit Depot Form Data
  const [editDepotData, setEditDepotData] = useState({
    name: '',
    latitude: 13.0,
    longitude: 80.0,
    ambulances: 0,
    available_ambulances: 0,
    rescue_teams: 0,
    available_rescue_teams: 0,
    boats: 0,
    available_boats: 0,
    supplies: 0,
    available_supplies: 0
  });

  // Load calculated resource demands
  const fetchDemands = useCallback(async () => {
    try {
      setLoadingDemands(true);
      const res = await disasterApi.getIncidentDemands();
      setDemandsData(res.data);
    } catch (err) {
      console.error('Failed to load incident demands', err);
    } finally {
      setLoadingDemands(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchDemands();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchDemands, allocations]);

  // Handle running OR-Tools solver
  const handleRunOptimizer = async () => {
    try {
      setRunning(true);
      setTransactionFeedback(null);
      const res = await disasterApi.solveOptimization();
      setSolverResult(res.data);
      if (onOptimizationRun) {
        onOptimizationRun();
      }
      setSelectedAllocations([]);
      fetchDemands();
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

  // Authorize & Dispatch (approved = true)
  const handleApproveDispatch = async () => {
    if (selectedAllocations.length === 0 || !commanderNotes.trim()) return;
    try {
      setApproving(true);
      const res = await disasterApi.approveDispatch(selectedAllocations, commanderNotes.trim(), true);
      setTransactionFeedback({
        type: 'success',
        status: 'Dispatched',
        count: res.data.approved_count,
        message: res.data.message,
        notes: commanderNotes.trim(),
        timestamp: new Date().toLocaleTimeString()
      });
      setSelectedAllocations([]);
      setCommanderNotes('');
      if (onDispatchApproved) {
        onDispatchApproved();
      }
      fetchDemands();
    } catch (err) {
      console.error('Dispatch approval failed', err);
      setTransactionFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Dispatch approval transaction failed.'
      });
    } finally {
      setApproving(false);
    }
  };

  // Reject / Cancel Proposed Allocations (approved = false, NO inventory deducted)
  const handleRejectAllocations = async () => {
    if (selectedAllocations.length === 0 || !commanderNotes.trim()) return;
    try {
      setApproving(true);
      const res = await disasterApi.approveDispatch(selectedAllocations, commanderNotes.trim(), false);
      setTransactionFeedback({
        type: 'warning',
        status: 'Rejected',
        count: res.data.rejected_count,
        message: res.data.message,
        notes: commanderNotes.trim(),
        timestamp: new Date().toLocaleTimeString()
      });
      setSelectedAllocations([]);
      setCommanderNotes('');
      if (onDispatchApproved) {
        onDispatchApproved();
      }
      fetchDemands();
    } catch (err) {
      console.error('Allocation rejection failed', err);
      setTransactionFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Allocation rejection failed.'
      });
    } finally {
      setApproving(false);
    }
  };

  // View SOP recommendation brief
  const handleViewRecommendation = async (incidentId) => {
    try {
      const res = await disasterApi.getRecommendations(incidentId);
      setSelectedIncidentRecommendation(res.data);
    } catch (err) {
      console.error('Failed to load recommendation', err);
    }
  };

  // Add new depot submit
  const handleCreateDepot = async (e) => {
    e.preventDefault();
    if (!newDepotData.name.trim()) {
      setDepotFormError('Depot name is required.');
      return;
    }
    try {
      setDepotFormSaving(true);
      setDepotFormError(null);
      await disasterApi.createDepot({
        name: newDepotData.name.trim(),
        latitude: parseFloat(newDepotData.latitude),
        longitude: parseFloat(newDepotData.longitude),
        ambulances: parseInt(newDepotData.ambulances) || 0,
        rescue_teams: parseInt(newDepotData.rescue_teams) || 0,
        boats: parseInt(newDepotData.boats) || 0,
        supplies: parseInt(newDepotData.supplies) || 0
      });
      setAddDepotModalOpen(false);
      setNewDepotData({
        name: '',
        latitude: 13.0382,
        longitude: 80.1565,
        ambulances: 15,
        rescue_teams: 10,
        boats: 6,
        supplies: 150
      });
      if (onDepotsChanged) onDepotsChanged();
      if (onOptimizationRun) onOptimizationRun();
      fetchDemands();
    } catch (err) {
      setDepotFormError(err.response?.data?.detail || 'Failed to create resource depot.');
    } finally {
      setDepotFormSaving(false);
    }
  };

  // Open edit modal
  const handleOpenEditDepot = (depot) => {
    setSelectedDepotForEdit(depot);
    setEditDepotData({
      name: depot.name,
      latitude: depot.latitude,
      longitude: depot.longitude,
      ambulances: depot.ambulances,
      available_ambulances: depot.available_ambulances,
      rescue_teams: depot.rescue_teams,
      available_rescue_teams: depot.available_rescue_teams,
      boats: depot.boats,
      available_boats: depot.available_boats,
      supplies: depot.supplies,
      available_supplies: depot.available_supplies
    });
    setDepotFormError(null);
    setEditDepotModalOpen(true);
  };

  // Update depot inventory submit
  const handleUpdateDepot = async (e) => {
    e.preventDefault();
    if (!selectedDepotForEdit) return;
    try {
      setDepotFormSaving(true);
      setDepotFormError(null);
      await disasterApi.updateDepot(selectedDepotForEdit.id, {
        name: editDepotData.name.trim(),
        latitude: parseFloat(editDepotData.latitude),
        longitude: parseFloat(editDepotData.longitude),
        ambulances: parseInt(editDepotData.ambulances) || 0,
        available_ambulances: parseInt(editDepotData.available_ambulances) || 0,
        rescue_teams: parseInt(editDepotData.rescue_teams) || 0,
        available_rescue_teams: parseInt(editDepotData.available_rescue_teams) || 0,
        boats: parseInt(editDepotData.boats) || 0,
        available_boats: parseInt(editDepotData.available_boats) || 0,
        supplies: parseInt(editDepotData.supplies) || 0,
        available_supplies: parseInt(editDepotData.available_supplies) || 0
      });
      setEditDepotModalOpen(false);
      setSelectedDepotForEdit(null);
      if (onDepotsChanged) onDepotsChanged();
      if (onOptimizationRun) onOptimizationRun();
      fetchDemands();
    } catch (err) {
      setDepotFormError(err.response?.data?.detail || 'Failed to update depot inventory.');
    } finally {
      setDepotFormSaving(false);
    }
  };

  // Delete depot
  const handleDeleteDepot = async (depot) => {
    if (!window.confirm(`Are you sure you want to remove depot "${depot.name}"?`)) return;
    try {
      await disasterApi.deleteDepot(depot.id);
      if (onDepotsChanged) onDepotsChanged();
      if (onOptimizationRun) onOptimizationRun();
      fetchDemands();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete depot.');
    }
  };

  const proposedCount = allocations.filter((a) => a.status === 'Proposed').length;

  // Aggregate depot totals
  const totalAmbulances = depots.reduce((sum, d) => sum + (d.ambulances || 0), 0);
  const availableAmbulances = depots.reduce((sum, d) => sum + (d.available_ambulances || 0), 0);
  const totalTeams = depots.reduce((sum, d) => sum + (d.rescue_teams || 0), 0);
  const availableTeams = depots.reduce((sum, d) => sum + (d.available_rescue_teams || 0), 0);
  const totalBoats = depots.reduce((sum, d) => sum + (d.boats || 0), 0);
  const availableBoats = depots.reduce((sum, d) => sum + (d.available_boats || 0), 0);
  const totalSupplies = depots.reduce((sum, d) => sum + (d.supplies || 0), 0);
  const availableSupplies = depots.reduce((sum, d) => sum + (d.available_supplies || 0), 0);

  return (
    <div className="space-y-6">
      {/* Module 2 Navigation Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveSubTab('optimizer')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'optimizer'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>OR-Tools Optimizer & Dispatch</span>
          </button>
          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Depot Inventory Management ({depots.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('demands')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'demands'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pre-Optimization Incident Demands</span>
          </button>
        </div>

        {activeSubTab === 'inventory' && (
          <button
            onClick={() => {
              setDepotFormError(null);
              setAddDepotModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold px-3 py-1.5 rounded-md shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>ADD RESOURCE DEPOT</span>
          </button>
        )}
      </div>

      {/* Transaction Feedback Banner */}
      {transactionFeedback && (
        <div
          className={`p-4 rounded-lg font-mono text-xs border shadow-lg flex items-start justify-between gap-3 ${
            transactionFeedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : transactionFeedback.type === 'warning'
              ? 'bg-amber-950/90 border-amber-800 text-amber-200'
              : 'bg-red-950/90 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {transactionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : transactionFeedback.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">
                TRANSACTION {transactionFeedback.status?.toUpperCase() || 'LOG'}: {transactionFeedback.message}
              </div>
              {transactionFeedback.notes && (
                <div className="text-[11px] opacity-80 mt-1">
                  Commander Sign-off: "{transactionFeedback.notes}" &bull; Executed at {transactionFeedback.timestamp}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setTransactionFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: DEPOT INVENTORY MANAGEMENT */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Aggregate KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-md">
              <div className="text-slate-400 text-[11px] mb-1">🚑 AMBULANCES</div>
              <div className="text-xl font-extrabold text-blue-400">
                {availableAmbulances} <span className="text-xs font-normal text-slate-500">/ {totalAmbulances}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Allocated: {totalAmbulances - availableAmbulances}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-md">
              <div className="text-slate-400 text-[11px] mb-1">👷 RESCUE TEAMS</div>
              <div className="text-xl font-extrabold text-emerald-400">
                {availableTeams} <span className="text-xs font-normal text-slate-500">/ {totalTeams}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Allocated: {totalTeams - availableTeams}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-md">
              <div className="text-slate-400 text-[11px] mb-1">🚤 RESCUE BOATS</div>
              <div className="text-xl font-extrabold text-cyan-400">
                {availableBoats} <span className="text-xs font-normal text-slate-500">/ {totalBoats}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Allocated: {totalBoats - availableBoats}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-md">
              <div className="text-slate-400 text-[11px] mb-1">📦 RELIEF SUPPLIES</div>
              <div className="text-xl font-extrabold text-amber-400">
                {availableSupplies} <span className="text-xs font-normal text-slate-500">/ {totalSupplies}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Allocated: {totalSupplies - availableSupplies}
              </div>
            </div>
          </div>

          {/* Depot Inventory Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                  <Database className="w-4 h-4 text-blue-400" />
                  Regional Emergency Resource Depots & Physical Inventory (SQLite Stored)
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Real-time depot stock tracking. Updates directly alter available inventory in SQLite and inform OR-Tools constraints.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">DEPOT NAME & LOCATION</th>
                    <th className="p-3 text-center">🚑 AMBULANCES (AVAIL / TOTAL)</th>
                    <th className="p-3 text-center">👷 RESCUE TEAMS (AVAIL / TOTAL)</th>
                    <th className="p-3 text-center">🚤 BOATS (AVAIL / TOTAL)</th>
                    <th className="p-3 text-center">📦 FOOD & WATER (AVAIL / TOTAL)</th>
                    <th className="p-3 text-right">INVENTORY ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {depots.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        No resource depots configured. Click "+ ADD RESOURCE DEPOT" to initialize depot inventory.
                      </td>
                    </tr>
                  ) : (
                    depots.map((depot) => {
                      const allocatedAmb = Math.max(0, depot.ambulances - depot.available_ambulances);
                      const allocatedTeams = Math.max(0, depot.rescue_teams - depot.available_rescue_teams);
                      const allocatedBoats = Math.max(0, depot.boats - depot.available_boats);
                      const allocatedSupplies = Math.max(0, depot.supplies - depot.available_supplies);

                      return (
                        <tr key={depot.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <div className="font-bold text-slate-100">🏢 {depot.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              GPS: {depot.latitude.toFixed(4)}, {depot.longitude.toFixed(4)}
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="font-bold text-blue-400">{depot.available_ambulances}</span>
                            <span className="text-slate-500 font-normal"> / {depot.ambulances}</span>
                            {allocatedAmb > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                (Disp: {allocatedAmb})
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="font-bold text-emerald-400">{depot.available_rescue_teams}</span>
                            <span className="text-slate-500 font-normal"> / {depot.rescue_teams}</span>
                            {allocatedTeams > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                (Disp: {allocatedTeams})
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="font-bold text-cyan-400">{depot.available_boats}</span>
                            <span className="text-slate-500 font-normal"> / {depot.boats}</span>
                            {allocatedBoats > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                (Disp: {allocatedBoats})
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="font-bold text-amber-400">{depot.available_supplies}</span>
                            <span className="text-slate-500 font-normal"> / {depot.supplies}</span>
                            {allocatedSupplies > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                (Disp: {allocatedSupplies})
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditDepot(depot)}
                                className="p-1.5 bg-slate-800 hover:bg-blue-900/60 text-slate-300 hover:text-blue-300 rounded border border-slate-700 transition"
                                title="Edit Depot Inventory Quantities"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDepot(depot)}
                                className="p-1.5 bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-400 rounded border border-slate-700 transition"
                                title="Delete Resource Depot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PRE-OPTIMIZATION INCIDENT DEMANDS */}
      {activeSubTab === 'demands' && (
        <div className="space-y-6">
          {/* Comparison Ribbon: Net Demand vs Total Available Depot Stock */}
          {demandsData && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Regional Disaster Demand vs Available Depot Inventory (Pre-Optimization Balance)
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Calculated via Random Forest disaster intelligence before mathematical solver execution.
                  </p>
                </div>
                <button
                  onClick={fetchDemands}
                  disabled={loadingDemands}
                  className="flex items-center gap-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDemands ? 'animate-spin' : ''}`} />
                  <span>Recalculate Demands</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs mb-4">
                {['ambulances', 'rescue_teams', 'boats', 'supplies'].map((resKey) => {
                  const netReq = demandsData.aggregated_net_demand[resKey] || 0;
                  const avail = demandsData.total_available_stock[resKey] || 0;
                  const isSufficient = avail >= netReq;
                  const labelMap = {
                    ambulances: 'Ambulances',
                    rescue_teams: 'Rescue Teams',
                    boats: 'Rescue Boats',
                    supplies: 'Food & Water Packs'
                  };

                  return (
                    <div
                      key={resKey}
                      className={`p-3 rounded-lg border ${
                        isSufficient
                          ? 'bg-slate-950/80 border-slate-800'
                          : 'bg-red-950/40 border-red-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                        <span>{labelMap[resKey]}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isSufficient
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-red-900 text-red-200 border border-red-700'
                          }`}
                        >
                          {demandsData.stock_status[resKey]}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-slate-400 text-[10px]">Net Demand:</span>
                        <span className="font-bold text-slate-100 text-sm">{netReq}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-400 text-[10px]">Stock Avail:</span>
                        <span
                          className={`font-bold text-sm ${
                            isSufficient ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {avail}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Individual Incident Demand Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">INCIDENT TITLE</th>
                      <th className="p-3">SEVERITY</th>
                      <th className="p-3">HAZARD / CASUALTIES</th>
                      <th className="p-3 text-center">GROSS REQUIRED</th>
                      <th className="p-3 text-center">ALREADY DISPATCHED</th>
                      <th className="p-3 text-center">NET REMAINING DEMAND</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {demandsData.incidents.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500">
                          No active disaster incidents currently requiring emergency resource allocation.
                        </td>
                      </tr>
                    ) : (
                      demandsData.incidents.map((inc) => (
                        <tr key={inc.incident_id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-semibold text-slate-100">
                            {inc.title}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {inc.location_name}
                            </div>
                          </td>
                          <td className="p-3">
                            <SeverityBadge severity={inc.severity_level} size="sm" />
                          </td>
                          <td className="p-3 text-slate-400">
                            {inc.disaster_type} &bull; {inc.casualties} casualties &bull; pop {inc.affected_population.toLocaleString()}
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="inline-flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              <span>🚑 {inc.gross_demand.ambulances}</span>
                              <span>👷 {inc.gross_demand.rescue_teams}</span>
                              <span>🚤 {inc.gross_demand.boats}</span>
                              <span>📦 {inc.gross_demand.supplies}</span>
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="inline-flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-emerald-400">
                              <span>🚑 {inc.already_dispatched.ambulances}</span>
                              <span>👷 {inc.already_dispatched.rescue_teams}</span>
                              <span>🚤 {inc.already_dispatched.boats}</span>
                              <span>📦 {inc.already_dispatched.supplies}</span>
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="inline-flex items-center gap-1.5 bg-purple-950/40 text-purple-300 px-2.5 py-0.5 rounded border border-purple-800/60 font-bold">
                              <span>🚑 {inc.net_demand.ambulances}</span>
                              <span>👷 {inc.net_demand.rescue_teams}</span>
                              <span>🚤 {inc.net_demand.boats}</span>
                              <span>📦 {inc.net_demand.supplies}</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: OR-TOOLS OPTIMIZER & DISPATCH CONSOLE */}
      {activeSubTab === 'optimizer' && (
        <div className="space-y-6">
          {/* Live Inventory Quick Ribbon */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                <Truck className="w-4 h-4 text-blue-400" />
                Regional Emergency Resource Depots (Live Inventory)
              </h3>
              <button
                onClick={() => setActiveSubTab('inventory')}
                className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <span>Manage Inventory</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {depots.map((depot) => (
                <div
                  key={depot.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs shadow-md"
                >
                  <div className="font-bold text-slate-200 truncate mb-2 text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
                    <span className="truncate">🏢 {depot.name}</span>
                    <button
                      onClick={() => handleOpenEditDepot(depot)}
                      className="text-slate-500 hover:text-blue-400 p-0.5"
                      title="Quick Edit Inventory"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
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
                      <span className="text-slate-400">Food & Water:</span>
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
                Mixed-Integer Linear Programming (MILP) solver optimizing multi-depot transit cost while strictly enforcing depot capacity limits and penalizing unmet critical triage demand.
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
                <span className="text-slate-500">EXECUTION TIME:</span>
                <span className="text-purple-400 font-bold">{solverResult.solver_execution_time_ms} ms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">PROPOSED ALLOCATIONS:</span>
                <span className="text-blue-400 font-bold">{solverResult.allocations_count} Orders</span>
              </div>
              {Object.keys(solverResult.unmet_demand || {}).length > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <AlertOctagon className="w-4 h-4" />
                  <span>REGIONAL RESOURCE SHORTAGE DETECTED</span>
                </div>
              )}
            </div>
          )}

          {/* Shortages / Unmet Demand Breakdown Table (if any) */}
          {solverResult && Object.keys(solverResult.unmet_demand || {}).length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800/80 rounded-xl p-4 shadow-xl">
              <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-xs mb-2">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                <span>UNMET DEMAND & REGIONAL RESOURCE SHORTAGE REPORT (OR-TOOLS SLACK ANALYSIS)</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mb-3">
                Total demand for the following incidents exceeds current depot stock availability across Chennai depots. Regional replenishment is required.
              </p>
              <div className="overflow-x-auto rounded border border-amber-900/60 bg-slate-950/80">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">INCIDENT WITH SHORTAGE</th>
                      <th className="p-2.5 text-center">UNMET AMBULANCES</th>
                      <th className="p-2.5 text-center">UNMET RESCUE TEAMS</th>
                      <th className="p-2.5 text-center">UNMET BOATS</th>
                      <th className="p-2.5 text-center">UNMET FOOD & WATER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-amber-200">
                    {Object.entries(solverResult.unmet_demand).map(([incidentTitle, shortages]) => (
                      <tr key={incidentTitle}>
                        <td className="p-2.5 font-bold text-slate-100">{incidentTitle}</td>
                        <td className="p-2.5 text-center">{shortages.ambulances ? `-${shortages.ambulances}` : '0'}</td>
                        <td className="p-2.5 text-center">{shortages.rescue_teams ? `-${shortages.rescue_teams}` : '0'}</td>
                        <td className="p-2.5 text-center">{shortages.boats ? `-${shortages.boats}` : '0'}</td>
                        <td className="p-2.5 text-center">{shortages.supplies ? `-${shortages.supplies}` : '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Human-in-the-Loop Approval Operations Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  Human-in-the-Loop Operational Dispatch Approval & Inventory Deductions
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Proposed allocations require explicit incident commander verification. Approved dispatches transactionally deduct depot stock in SQLite. Rejected allocations do NOT deduct inventory.
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

            {/* Commander Sign-Off Notes & Two-Way Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 font-mono text-xs">
              <div className="md:col-span-6">
                <label className="block text-slate-400 mb-1 flex items-center justify-between">
                  <span>MANDATORY COMMANDER SIGN-OFF NOTES:</span>
                  {!commanderNotes.trim() && (
                    <span className="text-amber-400 text-[10px] font-bold">AWAITING INPUT</span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Enter official authorization notes (e.g., Authorized by State Incident Commander)..."
                  value={commanderNotes}
                  onChange={(e) => setCommanderNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                />
              </div>

              {/* Action Buttons: Authorize vs Reject */}
              <div className="md:col-span-3 flex items-end">
                <button
                  onClick={handleApproveDispatch}
                  disabled={approving || selectedAllocations.length === 0 || !commanderNotes.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {approving
                      ? 'PROCESSING...'
                      : selectedAllocations.length === 0
                      ? 'SELECT ALLOCATIONS'
                      : !commanderNotes.trim()
                      ? 'ENTER NOTES'
                      : `AUTHORIZE & DISPATCH (${selectedAllocations.length})`}
                  </span>
                </button>
              </div>

              <div className="md:col-span-3 flex items-end">
                <button
                  onClick={handleRejectAllocations}
                  disabled={approving || selectedAllocations.length === 0 || !commanderNotes.trim()}
                  className="w-full bg-red-900/80 hover:bg-red-800 active:scale-95 text-red-100 font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  <span>
                    {selectedAllocations.length === 0
                      ? 'CANCEL / REJECT'
                      : `REJECT SELECTED (${selectedAllocations.length})`}
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
                      const isRejected = alloc.status === 'Rejected';

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
                              disabled={isDispatched || isRejected}
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
                                  : isRejected
                                  ? 'bg-red-950/80 text-red-400 border-red-800'
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
        </div>
      )}

      {/* MODAL 1: ADD RESOURCE DEPOT */}
      {addDepotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl font-mono text-xs text-slate-300 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  Add New Regional Emergency Resource Depot
                </h4>
              </div>
              <button
                onClick={() => setAddDepotModalOpen(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {depotFormError && (
              <div className="p-2.5 bg-red-950 border border-red-800 rounded text-red-200">
                {depotFormError}
              </div>
            )}

            <form onSubmit={handleCreateDepot} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">DEPOT FACILITY NAME:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Porur Emergency Operations Sub-Station"
                  value={newDepotData.name}
                  onChange={(e) => setNewDepotData({ ...newDepotData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">LATITUDE (GPS):</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepotData.latitude}
                    onChange={(e) => setNewDepotData({ ...newDepotData, latitude: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">LONGITUDE (GPS):</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepotData.longitude}
                    onChange={(e) => setNewDepotData({ ...newDepotData, longitude: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-400 font-bold block mb-2">INITIAL RESOURCE INVENTORY STOCK:</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">🚑 AMBULANCES:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newDepotData.ambulances}
                      onChange={(e) => setNewDepotData({ ...newDepotData, ambulances: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">👷 RESCUE TEAMS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newDepotData.rescue_teams}
                      onChange={(e) => setNewDepotData({ ...newDepotData, rescue_teams: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">🚤 RESCUE BOATS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newDepotData.boats}
                      onChange={(e) => setNewDepotData({ ...newDepotData, boats: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">📦 RELIEF SUPPLIES (FOOD/WATER):</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newDepotData.supplies}
                      onChange={(e) => setNewDepotData({ ...newDepotData, supplies: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddDepotModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depotFormSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{depotFormSaving ? 'Saving...' : 'Save Depot to SQLite'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT DEPOT INVENTORY */}
      {editDepotModalOpen && selectedDepotForEdit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl font-mono text-xs text-slate-300 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  Update Inventory: {selectedDepotForEdit.name}
                </h4>
              </div>
              <button
                onClick={() => setEditDepotModalOpen(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {depotFormError && (
              <div className="p-2.5 bg-red-950 border border-red-800 rounded text-red-200">
                {depotFormError}
              </div>
            )}

            <form onSubmit={handleUpdateDepot} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">DEPOT FACILITY NAME:</label>
                <input
                  type="text"
                  required
                  value={editDepotData.name}
                  onChange={(e) => setEditDepotData({ ...editDepotData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-400 font-bold block mb-2">INVENTORY QUANTITIES (AVAILABLE / TOTAL):</span>
                
                {/* Ambulances */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">AVAILABLE AMBULANCES:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.available_ambulances}
                      onChange={(e) => setEditDepotData({ ...editDepotData, available_ambulances: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-blue-400 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">TOTAL AMBULANCE FLEET:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.ambulances}
                      onChange={(e) => setEditDepotData({ ...editDepotData, ambulances: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Rescue Teams */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">AVAILABLE RESCUE TEAMS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.available_rescue_teams}
                      onChange={(e) => setEditDepotData({ ...editDepotData, available_rescue_teams: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-emerald-400 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">TOTAL RESCUE TEAMS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.rescue_teams}
                      onChange={(e) => setEditDepotData({ ...editDepotData, rescue_teams: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Rescue Boats */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">AVAILABLE BOATS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.available_boats}
                      onChange={(e) => setEditDepotData({ ...editDepotData, available_boats: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-cyan-400 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">TOTAL BOATS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.boats}
                      onChange={(e) => setEditDepotData({ ...editDepotData, boats: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Supplies */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">AVAILABLE FOOD & WATER PACKS:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.available_supplies}
                      onChange={(e) => setEditDepotData({ ...editDepotData, available_supplies: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-amber-400 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">TOTAL PACKS IN STOCK:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editDepotData.supplies}
                      onChange={(e) => setEditDepotData({ ...editDepotData, supplies: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditDepotModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depotFormSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{depotFormSaving ? 'Updating...' : 'Save Inventory to SQLite'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EMERGENCY TACTICAL SOP MODAL */}
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
