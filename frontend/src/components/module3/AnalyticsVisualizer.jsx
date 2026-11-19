import React from 'react';
import Plot from 'react-plotly.js';
import { BarChart3, PieChart, ShieldAlert, FileText, Download } from 'lucide-react';

export const AnalyticsVisualizer = ({ analyticsData, summary }) => {
  if (!analyticsData) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-xs">
        Loading analytics telemetry...
      </div>
    );
  }

  const { severity_distribution = {}, hazard_type_breakdown = [], depot_utilization = [], risk_matrix = [] } = analyticsData;

  // Chart 1: Severity Donut
  const severityLabels = Object.keys(severity_distribution);
  const severityValues = Object.values(severity_distribution);
  const severityColors = {
    Critical: '#ef4444',
    High: '#f59e0b',
    Medium: '#eab308',
    Low: '#10b981',
  };

  const donutData = [
    {
      labels: severityLabels,
      values: severityValues,
      type: 'pie',
      hole: 0.55,
      marker: {
        colors: severityLabels.map((l) => severityColors[l] || '#94a3b8'),
      },
      textinfo: 'label+percent',
      insidetextorientation: 'radial',
      hoverinfo: 'label+value+percent',
    },
  ];

  const donutLayout = {
    title: {
      text: 'Incident Severity Triage Distribution',
      font: { color: '#f1f5f9', size: 14, family: 'monospace' },
    },
    paper_bgcolor: '#090d1a',
    plot_bgcolor: '#090d1a',
    showlegend: true,
    legend: { font: { color: '#94a3b8', size: 11 } },
    margin: { t: 40, b: 20, l: 20, r: 20 },
    height: 320,
    autosize: true,
  };

  // Chart 2: Hazard Type Breakdown (Bar Chart)
  const hazardLabels = hazard_type_breakdown.map((h) => h.disaster_type);
  const hazardCasualties = hazard_type_breakdown.map((h) => h.total_cas);
  const hazardPop = hazard_type_breakdown.map((h) => h.total_pop);

  const barData = [
    {
      x: hazardLabels,
      y: hazardCasualties,
      name: 'Reported Casualties',
      type: 'bar',
      marker: { color: '#ef4444' },
    },
    {
      x: hazardLabels,
      y: hazardPop,
      name: 'Exposed Population',
      type: 'bar',
      yaxis: 'y2',
      marker: { color: '#3b82f6', opacity: 0.7 },
    },
  ];

  const barLayout = {
    title: {
      text: 'Casualties & Population by Hazard Type',
      font: { color: '#f1f5f9', size: 14, family: 'monospace' },
    },
    paper_bgcolor: '#090d1a',
    plot_bgcolor: '#090d1a',
    barmode: 'group',
    legend: { font: { color: '#94a3b8', size: 11 } },
    yaxis: {
      title: 'Casualties',
      titlefont: { color: '#ef4444', size: 11 },
      tickfont: { color: '#ef4444' },
    },
    yaxis2: {
      title: 'Exposed Population',
      titlefont: { color: '#3b82f6', size: 11 },
      tickfont: { color: '#3b82f6' },
      overlaying: 'y',
      side: 'right',
    },
    xaxis: { tickfont: { color: '#94a3b8', size: 11 } },
    margin: { t: 40, b: 40, l: 45, r: 45 },
    height: 320,
    autosize: true,
  };

  // Chart 3: Depot Utilization (Stacked Bar)
  const depotNames = depot_utilization.map((d) => d.name.split('(')[0].trim());
  const deployedAmb = depot_utilization.map((d) => d.deployed_ambulances);
  const deployedTeams = depot_utilization.map((d) => d.deployed_teams);
  const deployedBoats = depot_utilization.map((d) => d.deployed_boats);

  const depotData = [
    { x: depotNames, y: deployedAmb, name: 'Ambulances Deployed', type: 'bar', marker: { color: '#3b82f6' } },
    { x: depotNames, y: deployedTeams, name: 'Rescue Teams Deployed', type: 'bar', marker: { color: '#10b981' } },
    { x: depotNames, y: deployedBoats, name: 'Boats Deployed', type: 'bar', marker: { color: '#06b6d4' } },
  ];

  const depotLayout = {
    title: {
      text: 'Regional Asset Deployment by Depot',
      font: { color: '#f1f5f9', size: 14, family: 'monospace' },
    },
    paper_bgcolor: '#090d1a',
    plot_bgcolor: '#090d1a',
    barmode: 'stack',
    legend: { font: { color: '#94a3b8', size: 11 } },
    yaxis: { title: 'Deployed Assets Count', titlefont: { color: '#94a3b8', size: 11 }, tickfont: { color: '#94a3b8' } },
    xaxis: { tickfont: { color: '#94a3b8', size: 10 } },
    margin: { t: 40, b: 60, l: 40, r: 20 },
    height: 320,
    autosize: true,
  };

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Disaster Analytics & Situation Debrief Center
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Module 3: Visual decision support and executive situation reports powered by Plotly.js
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md border border-slate-700 flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>EXPORT SITUATION REPORT</span>
        </button>
      </div>

      {/* Plotly Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity Distribution Donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl overflow-hidden">
          <Plot data={donutData} layout={donutLayout} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%' }} />
        </div>

        {/* Hazard vs Casualties Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl overflow-hidden">
          <Plot data={barData} layout={barLayout} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%' }} />
        </div>

        {/* Asset Deployment Stacked Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl overflow-hidden lg:col-span-2">
          <Plot data={depotData} layout={depotLayout} config={{ responsive: true, displayModeBar: false }} style={{ width: '100%' }} />
        </div>
      </div>

      {/* Executive Operational Debrief Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl font-mono text-xs text-slate-300 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h4 className="font-bold text-slate-100 uppercase tracking-wider">
              Emergency Operations Center (EOC) Official Debrief Summary
            </h4>
          </div>
          <span className="text-[10px] text-slate-500">GENERATED IN ACCORDANCE WITH CSA10 GUIDELINES</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">TOTAL DISASTERS</span>
            <span className="text-xl font-bold text-slate-100">{summary?.active_incidents || 0}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">CRITICAL CASUALTIES</span>
            <span className="text-xl font-bold text-red-400">{summary?.total_casualties || 0}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">TOTAL POPULATION AT RISK</span>
            <span className="text-xl font-bold text-blue-400">{(summary?.total_affected_population || 0).toLocaleString()}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">AMBULANCES DEPLOYED</span>
            <span className="text-xl font-bold text-emerald-400">
              {summary?.total_ambulances_deployed || 0} / {(summary?.total_ambulances_deployed || 0) + (summary?.total_ambulances_available || 0)}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-[11px] leading-relaxed text-slate-400 space-y-2">
          <p>
            <b className="text-slate-200">Software Engineering Quality Declaration:</b> RESCUENET AI executes modular separation across:
            (1) Machine learning intelligence via trained Random Forest classification,
            (2) Mathematical optimization via Google OR-Tools CBC Mixed-Integer Programming, and
            (3) Spatial-temporal visualization via Leaflet GIS and Plotly analytics.
          </p>
          <p>
            <b className="text-slate-200">Ethical & Responsible AI Statement:</b> All AI severity predictions and optimization outputs serve strictly as computerized decision-support recommendations. In adherence to human-in-the-loop safety principles, formal deployment requires manual verification and sign-off by a designated incident commander.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsVisualizer;
