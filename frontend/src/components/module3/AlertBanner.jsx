import React from 'react';
import { AlertOctagon, X } from 'lucide-react';
import { disasterApi } from '../../api/client';

export const AlertBanner = ({ alerts, onAlertDismissed }) => {
  if (!alerts || alerts.length === 0) return null;

  const handleDismiss = async (alertId) => {
    try {
      await disasterApi.dismissAlert(alertId);
      if (onAlertDismissed) {
        onAlertDismissed(alertId);
      }
    } catch (err) {
      console.error('Failed to dismiss alert', err);
    }
  };

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => {
        const isCritical = alert.alert_level === 'Critical';
        return (
          <div
            key={alert.id}
            className={`flex items-start justify-between gap-3 p-3.5 rounded-lg border text-xs font-mono transition shadow-lg ${
              isCritical
                ? 'bg-red-950/90 border-red-500/80 text-red-200 shadow-red-950/40 animate-emergency'
                : 'bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-amber-950/30'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded bg-black/30 shrink-0 mt-0.5">
                <AlertOctagon className={`w-4 h-4 ${isCritical ? 'text-red-400 animate-spin' : 'text-amber-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] underline">
                    {alert.headline}
                  </span>
                  <span className="text-[10px] opacity-75 font-normal">
                    {alert.created_at || 'LIVE'}
                  </span>
                </div>
                <p className="mt-1 text-slate-300 leading-snug">{alert.message}</p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              title="Dismiss Alert"
              className="p-1 rounded hover:bg-black/40 text-slate-400 hover:text-slate-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AlertBanner;
