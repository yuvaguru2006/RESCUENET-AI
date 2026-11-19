import React from 'react';
import { Map, BrainCircuit, Truck, BarChart3, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, activeAlertsCount, activeIncidentsCount }) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Operational Command Map',
      badge: 'LIVE',
      badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800',
      icon: Map,
      description: 'Geospatial situation & dispatch lines',
    },
    {
      id: 'module1',
      label: 'Module 1: AI Disaster Intelligence',
      badge: `${activeIncidentsCount} INCIDENTS`,
      badgeColor: 'bg-blue-950 text-blue-400 border-blue-800',
      icon: BrainCircuit,
      description: 'Incident registration & ML severity prediction',
    },
    {
      id: 'module2',
      label: 'Module 2: Decision Support & Optimization',
      badge: 'OR-TOOLS',
      badgeColor: 'bg-purple-950 text-purple-400 border-purple-800',
      icon: Truck,
      description: 'Resource calculation & dispatch approval',
    },
    {
      id: 'module3',
      label: 'Module 3: Monitoring & Analytics',
      badge: 'PLOTLY',
      badgeColor: 'bg-amber-950 text-amber-400 border-amber-800',
      icon: BarChart3,
      description: 'Severity analytics & situation debrief reports',
    },
  ];

  return (
    <aside className="w-full lg:w-72 bg-slate-950 border-r border-slate-800 flex flex-col p-4 shrink-0">
      <div className="mb-4">
        <h2 className="text-xs uppercase tracking-widest font-mono text-slate-500 font-bold px-2 mb-2">
          Platform Navigation
        </h2>
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                  isActive
                    ? 'bg-slate-900 border-blue-500/80 shadow-md shadow-blue-950/40 text-slate-100'
                    : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:bg-slate-900/80 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 font-semibold text-sm">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal pl-6.5 truncate">
                  {item.description}
                </p>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Integrity Info Box */}
      <div className="mt-auto pt-4 border-t border-slate-900">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>ACTIVE ALERTS:</span>
            <span className={`font-bold ${activeAlertsCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
              {activeAlertsCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>ML ENGINE:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Scikit-learn RF
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>OPTIMIZER:</span>
            <span className="text-purple-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> OR-Tools MIP
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
