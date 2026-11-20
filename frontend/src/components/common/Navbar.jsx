import React, { useSyncExternalStore } from 'react';
import { ShieldAlert, RefreshCw, Radio, User, LogOut, LogIn, ArrowLeftRight } from 'lucide-react';

const subscribeTime = (callback) => {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
};

const getTimeSnapshot = () => new Date().toLocaleTimeString();
const getTimeServerSnapshot = () => '--:--:--';

export const Navbar = ({
  backendHealthy,
  onRefresh,
  refreshing,
  currentUser,
  onOpenAuth,
  onLogout,
  viewMode,
  onSwitchView
}) => {
  const time = useSyncExternalStore(subscribeTime, getTimeSnapshot, getTimeServerSnapshot);

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-slate-100 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shadow-inner">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-wider text-slate-100">
                RESCUE<span className="text-red-500">NET</span>
              </span>
              <span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-0.5 rounded font-mono border border-blue-500/30">
                AI PLATFORM
              </span>
            </div>
            <p className="text-xs text-slate-400 tracking-wide font-mono hidden sm:block">
              ROLE-BASED DISASTER INTELLIGENCE & CITIZEN SAFETY
            </p>
          </div>
        </div>

        {/* Center Pill: Academic Disclaimer */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono text-slate-400">
          <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>CSA10 CAPSTONE &bull; ACADEMIC PROTOTYPE &bull; SIMULATED CHENNAI DATA</span>
        </div>

        {/* Right Status & Auth Controls */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Connection Status */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-md">
            <span
              className={`w-2 h-2 rounded-full ${
                backendHealthy ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className={backendHealthy ? 'text-emerald-400' : 'text-red-400'}>
              {backendHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Clock */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded-md border border-slate-800">
            <span>{time || '--:--:--'}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh All Telemetry"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 px-2.5 py-1.5 rounded-md border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden lg:inline">SYNC</span>
          </button>

          {/* User Auth Section */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* Role Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-purple-950/80 border-purple-800 text-purple-300'
                    : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="font-bold">
                  {currentUser.role === 'ADMIN' ? 'COMMANDER' : 'CITIZEN'}:
                </span>
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {currentUser.full_name || currentUser.username}
                </span>
              </div>

              {/* View Switcher for Admins (can view Citizen portal or Admin console) */}
              {currentUser.role === 'ADMIN' && (
                <button
                  onClick={onSwitchView}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-md transition text-xs"
                  title="Switch between Citizen and Commander Interface"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {viewMode === 'admin' ? 'View Citizen' : 'View Command'}
                  </span>
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-1.5 bg-slate-800 hover:bg-red-950/80 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-md transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-3 py-1.5 rounded-md shadow-md transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
