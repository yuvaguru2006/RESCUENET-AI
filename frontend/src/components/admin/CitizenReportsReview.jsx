import React, { useState, useEffect } from 'react';
import { disasterApi } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import { ShieldCheck, RefreshCw, ExternalLink, UserCheck, AlertOctagon } from 'lucide-react';

export const CitizenReportsReview = ({ onStatusUpdated }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeModalImage, setActiveModalImage] = useState(null);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await disasterApi.getCitizenSubmissions();
      setSubmissions(res.data);
    } catch (err) {
      console.error('Failed to load citizen submissions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) fetchSubmissions();
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdateStatus = async (incidentId, newStatus) => {
    try {
      setUpdatingId(incidentId);
      await disasterApi.updateIncidentStatus(
        incidentId,
        newStatus,
        `Status updated to ${newStatus} by Incident Commander.`
      );
      await fetchSubmissions();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update incident status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl font-mono text-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div>
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            Citizen Incident Ingest & Verification Console
          </h3>
          <p className="text-[11px] text-slate-400">
            Review citizen-submitted disaster reports and SOS alerts. Verify reports to immediately enroll them into Module 2 OR-Tools fleet allocation.
          </p>
        </div>
        <button
          onClick={fetchSubmissions}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
          <span>Loading citizen field reports...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-10 text-center text-slate-500">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <span>No citizen-reported incidents in the intake queue.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3">ID & INCIDENT</th>
                <th className="p-3">REPORTER</th>
                <th className="p-3">AI SEVERITY & RISK</th>
                <th className="p-3">EVIDENCE PHOTO</th>
                <th className="p-3">SITUATION NOTES</th>
                <th className="p-3">CURRENT STATUS</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3">
                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                      {sub.is_sos === 1 && (
                        <AlertOctagon className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                      )}
                      <span>#{sub.id} {sub.title}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      📍 {sub.location_name} ({sub.latitude?.toFixed(4)}, {sub.longitude?.toFixed(4)})
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-slate-200">{sub.reporter_name || 'Citizen'}</div>
                    <div className="text-[10px] text-slate-500">
                      {sub.reporter_phone || sub.reporter_username || 'N/A'}
                    </div>
                  </td>

                  <td className="p-3">
                    <SeverityBadge severity={sub.severity_level} size="sm" />
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Risk Index: <span className="font-bold text-slate-200">{sub.risk_score}</span>/100
                    </div>
                  </td>

                  <td className="p-3">
                    {sub.image_url ? (
                      <button
                        type="button"
                        onClick={() => setActiveModalImage(`http://localhost:8000${sub.image_url}`)}
                        className="group relative inline-block rounded overflow-hidden border border-slate-700 hover:border-blue-500 transition"
                      >
                        <img
                          src={`http://localhost:8000${sub.image_url}`}
                          alt="Incident evidence"
                          className="w-14 h-10 object-cover"
                        />
                        <span className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-blue-400">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[10px]">No photo attached</span>
                    )}
                  </td>

                  <td className="p-3 max-w-xs">
                    <p className="text-[11px] text-slate-300 line-clamp-2 italic">
                      "{sub.description || 'No description provided.'}"
                    </p>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        sub.status === 'Resolved'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : sub.status === 'Dispatched'
                          ? 'bg-purple-950 text-purple-400 border-purple-800'
                          : sub.status === 'Verified'
                          ? 'bg-blue-950 text-blue-400 border-blue-800'
                          : 'bg-amber-950 text-amber-400 border-amber-800'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {sub.status === 'Reported' && (
                        <button
                          onClick={() => handleUpdateStatus(sub.id, 'Verified')}
                          disabled={updatingId === sub.id}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded text-[10px] font-bold transition disabled:opacity-50"
                        >
                          {updatingId === sub.id ? 'VERIFYING...' : 'VERIFY INCIDENT'}
                        </button>
                      )}
                      {sub.status === 'Verified' && (
                        <button
                          onClick={() => handleUpdateStatus(sub.id, 'Active')}
                          disabled={updatingId === sub.id}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white rounded text-[10px] font-bold transition disabled:opacity-50"
                        >
                          SET ACTIVE
                        </button>
                      )}
                      {sub.status !== 'Resolved' && (
                        <button
                          onClick={() => handleUpdateStatus(sub.id, 'Resolved')}
                          disabled={updatingId === sub.id}
                          className="px-2 py-1 bg-slate-950 hover:bg-emerald-950 text-slate-400 hover:text-emerald-400 border border-slate-700 hover:border-emerald-600 rounded text-[10px] font-bold transition disabled:opacity-50"
                        >
                          RESOLVE
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Evidence Image Lightbox Modal */}
      {activeModalImage && (
        <div
          onClick={() => setActiveModalImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-xl p-2 shadow-2xl overflow-hidden">
            <img src={activeModalImage} alt="Full evidence view" className="max-h-[80vh] w-auto rounded object-contain" />
            <div className="p-2 text-center text-slate-400 text-xs">Click anywhere to close full photo view</div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CitizenReportsReview;
