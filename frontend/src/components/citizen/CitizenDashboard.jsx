import React, { useState, useEffect } from 'react';
import { disasterApi } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import {
  AlertOctagon,
  Camera,
  MapPin,
  Send,
  PhoneCall,
  Activity,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  X
} from 'lucide-react';

const CHENNAI_QUICK_PRESETS = [
  { name: 'Velachery, Chennai', lat: 12.9750, lng: 80.2207 },
  { name: 'Marina Coastal Strip, Chennai', lat: 13.0500, lng: 80.2824 },
  { name: 'Parrys / George Town, Chennai', lat: 13.0900, lng: 80.2860 },
  { name: 'Tambaram West, Chennai', lat: 12.9300, lng: 80.1200 },
  { name: 'Adyar River Corridor, Chennai', lat: 13.0100, lng: 80.2500 },
  { name: 'Anna Nagar West, Chennai', lat: 13.0850, lng: 80.2101 },
  { name: 'T. Nagar Commercial Zone, Chennai', lat: 13.0418, lng: 80.2341 },
];

export const CitizenDashboard = ({ user, alerts = [], onReportSubmitted }) => {
  const [activeTab, setActiveTab] = useState('sos'); // 'sos', 'report', 'my_reports'
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // SOS state
  const [sosStatus, setSosStatus] = useState(null);
  const [sosLoading, setSosLoading] = useState(false);

  // Disaster reporting state
  const [reportForm, setReportForm] = useState({
    disaster_type: 'Flood',
    location_name: 'Velachery, Chennai',
    latitude: 12.9750,
    longitude: 80.2207,
    description: '',
    casualties: 0,
    affected_population: 50,
    damage_level: 2,
    weather_condition: 'Severe Rain',
    image_base64: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(null);
  const [reportError, setReportError] = useState(null);

  // Fetch citizen's submitted reports
  const fetchMyReports = async () => {
    try {
      setLoadingReports(true);
      const res = await disasterApi.getMyReports();
      setMyReports(res.data);
    } catch (err) {
      console.error('Failed to fetch personal reports', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) fetchMyReports();
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Browser Geolocation Detector
  const handleDetectGPS = (target) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(4));
          const lng = parseFloat(pos.coords.longitude.toFixed(4));
          if (target === 'report') {
            setReportForm((prev) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              location_name: `Live GPS (${lat}, ${lng})`,
            }));
          }
        },
        () => {
          alert('GPS location detection failed or was denied. Using current preset.');
        }
      );
    }
  };

  // Image Upload Handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please upload a smaller photo.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setReportForm((prev) => ({ ...prev, image_base64: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit SOS Distress Signal
  const handleSendSOS = async () => {
    try {
      setSosLoading(true);
      setSosStatus(null);
      const res = await disasterApi.sendSOS({
        latitude: reportForm.latitude || 13.0827,
        longitude: reportForm.longitude || 80.2707,
        location_name: reportForm.location_name || 'Emergency Coordinates',
        phone: user?.phone || '',
        note: 'Immediate search, evacuation and life-safety support required!',
      });
      setSosStatus({
        success: true,
        message: `EMERGENCY SOS TRANSMITTED! Incident #${res.data.id} registered as CRITICAL. Emergency Response Units have been alerted.`,
      });
      fetchMyReports();
      if (onReportSubmitted) onReportSubmitted();
    } catch (err) {
      console.error('SOS failed', err);
      setSosStatus({
        success: false,
        message: 'Failed to transmit SOS signal. Please call State Disaster Control Room at 1070 or 112 immediately!',
      });
    } finally {
      setSosLoading(false);
    }
  };

  // Submit Hazard Report
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReport(true);
    setReportSuccess(null);
    setReportError(null);

    try {
      const res = await disasterApi.reportCitizenIncident(reportForm);
      setReportSuccess(
        `Disaster Report Submitted! AI classified risk as ${res.data.severity_level} (Risk: ${res.data.risk_score}/100). Status: Under Commander Review.`
      );
      setReportForm((prev) => ({
        ...prev,
        description: '',
        image_base64: null,
      }));
      setImagePreview(null);
      fetchMyReports();
      if (onReportSubmitted) onReportSubmitted();
    } catch (err) {
      console.error('Report submission failed', err);
      setReportError(err.response?.data?.detail || 'Failed to submit disaster report. Please retry.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
      {/* Citizen Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
              CITIZEN SAFETY PORTAL
            </span>
            <span className="text-slate-400 text-xs">CHENNAI DISASTER NETWORK</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100">
            Welcome, {user?.full_name || user?.username || 'Citizen'}
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Report on-ground disaster hazards, upload evidence photos, trigger SOS distress signals, and track relief deployments.
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <a
            href="tel:112"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-red-950/90 text-red-300 border border-red-700/80 rounded-lg font-bold hover:bg-red-900 transition text-[11px]"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>DIAL 112 (NATIONAL)</span>
          </a>
          <a
            href="tel:1070"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-950/90 text-amber-300 border border-amber-700/80 rounded-lg font-bold hover:bg-amber-900 transition text-[11px]"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>1070 (TN DISASTER)</span>
          </a>
        </div>
      </div>

      {/* Regional Safety Alerts Broadcast */}
      {alerts && alerts.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3 flex items-center gap-2 text-red-300">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          <div className="flex-1 truncate">
            <span className="font-bold text-red-400 mr-2">ACTIVE CHENNAI ALERT:</span>
            <span>{alerts[0].headline} — {alerts[0].message}</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="grid grid-cols-3 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('sos')}
          className={`py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
            activeTab === 'sos'
              ? 'bg-red-600 text-white shadow-lg shadow-red-950/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>EMERGENCY SOS</span>
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
            activeTab === 'report'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>REPORT HAZARD</span>
        </button>
        <button
          onClick={() => { setActiveTab('my_reports'); fetchMyReports(); }}
          className={`py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
            activeTab === 'my_reports'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>MY REPORTS ({myReports.length})</span>
        </button>
      </div>

      {/* TAB 1: EMERGENCY SOS */}
      {activeTab === 'sos' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xl text-center space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl font-extrabold text-slate-100 flex items-center justify-center gap-2">
              <AlertOctagon className="w-6 h-6 text-red-500 animate-pulse" />
              ONE-CLICK CITIZEN SOS DISTRESS
            </h3>
            <p className="text-slate-400 text-xs">
              Press the SOS button below if you or people around you are in life-threatening danger.
              Transmits GPS coordinates to the Central EOC with highest critical triage priority.
            </p>
          </div>

          {sosStatus && (
            <div
              className={`p-4 rounded-xl border max-w-lg mx-auto text-left flex items-start gap-3 ${
                sosStatus.success
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-red-950/80 border-red-500 text-red-300'
              }`}
            >
              {sosStatus.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              )}
              <span className="text-xs">{sosStatus.message}</span>
            </div>
          )}

          {/* Big Circular Pulsing SOS Button */}
          <div className="py-4">
            <button
              onClick={handleSendSOS}
              disabled={sosLoading}
              className="w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 hover:scale-105 active:scale-95 transition shadow-2xl shadow-red-600/50 border-4 border-red-400 flex flex-col items-center justify-center gap-2 text-white mx-auto disabled:opacity-50 cursor-pointer"
            >
              <AlertOctagon className={`w-14 h-14 ${sosLoading ? 'animate-spin' : 'animate-bounce'}`} />
              <span className="text-2xl font-black tracking-widest">
                {sosLoading ? 'TRANSMITTING...' : 'TRIGGER SOS'}
              </span>
              <span className="text-[10px] text-red-100 tracking-normal font-sans">
                INSTANT CRITICAL ALARM
              </span>
            </button>
          </div>

          {/* Coordinates Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-w-lg mx-auto text-slate-300 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] text-slate-500 block uppercase">TRANSMISSION LOCATION:</span>
              <span className="font-bold text-slate-200">{reportForm.location_name}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDetectGPS('report')}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 underline"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Detect Current GPS</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: REPORT DISASTER HAZARD */}
      {activeTab === 'report' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" />
                Citizen Disaster Incident Telemetry Intake
              </h3>
              <p className="text-xs text-slate-400">
                Provide incident details, attach photo evidence, and receive real-time Scikit-learn AI severity scoring.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px]">
              AI ASSISTED
            </span>
          </div>

          {reportSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500 rounded-lg text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{reportSuccess}</span>
            </div>
          )}

          {reportError && (
            <div className="p-3 bg-red-950/80 border border-red-500 rounded-lg text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{reportError}</span>
            </div>
          )}

          <form onSubmit={handleReportSubmit} className="space-y-4">
            {/* Disaster Type & Location Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">HAZARD / DISASTER TYPE:</label>
                <select
                  value={reportForm.disaster_type}
                  onChange={(e) => setReportForm({ ...reportForm, disaster_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="Flood">Flood (Severe Inundation / Overflow)</option>
                  <option value="Cyclone">Cyclone (Storm Surge / Wind Damage)</option>
                  <option value="Building Collapse">Building Collapse / Structural Failure</option>
                  <option value="Earthquake">Earthquake (Tremors / Damage)</option>
                  <option value="Wildfire">Fire / Industrial Blaze</option>
                  <option value="Landslide">Landslide / Soil Subsidence</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold">LOCATION PRESET (CHENNAI):</label>
                  <button
                    type="button"
                    onClick={() => handleDetectGPS('report')}
                    className="text-blue-400 hover:text-blue-300 text-[11px] flex items-center gap-1 underline"
                  >
                    <MapPin className="w-3 h-3" /> Use My GPS
                  </button>
                </div>
                <select
                  value={reportForm.location_name}
                  onChange={(e) => {
                    const found = CHENNAI_QUICK_PRESETS.find((p) => p.name === e.target.value);
                    if (found) {
                      setReportForm({
                        ...reportForm,
                        location_name: found.name,
                        latitude: found.lat,
                        longitude: found.lng,
                      });
                    } else {
                      setReportForm({ ...reportForm, location_name: e.target.value });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {CHENNAI_QUICK_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Narrative Description */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                SITUATION DESCRIPTION (OBSERVED DETAILS):
              </label>
              <textarea
                rows={3}
                required
                placeholder="Describe what you see: water depth, damaged infrastructure, trapped people, medical emergencies..."
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Evidence Photo Upload */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                ATTACH PHOTOGRAPHIC EVIDENCE (MAX 5MB):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white file:font-mono file:text-xs hover:file:bg-blue-500 cursor-pointer"
                />
                {imagePreview && (
                  <div className="relative inline-block border border-slate-700 rounded-lg overflow-hidden max-h-36">
                    <img src={imagePreview} alt="Evidence preview" className="h-32 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); setReportForm({ ...reportForm, image_base64: null }); }}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Estimated Casualties, Population & Damage Level */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-slate-400 mb-1">ESTIMATED CASUALTIES:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reportForm.casualties}
                  onChange={(e) => setReportForm({ ...reportForm, casualties: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-red-500 font-bold text-red-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ESTIMATED AFFECTED POPULATION:</label>
                <input
                  type="number"
                  min="0"
                  max="50000"
                  step="50"
                  value={reportForm.affected_population}
                  onChange={(e) => setReportForm({ ...reportForm, affected_population: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500 font-bold text-blue-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">DAMAGE SEVERITY (1-5):</label>
                <select
                  value={reportForm.damage_level}
                  onChange={(e) => setReportForm({ ...reportForm, damage_level: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="1">Level 1 - Minor / Waterlogging</option>
                  <option value="2">Level 2 - Moderate / Local Road Cut</option>
                  <option value="3">Level 3 - Severe / Substation Inundation</option>
                  <option value="4">Level 4 - Major / Structural Collapse</option>
                  <option value="5">Level 5 - Catastrophic Emergency</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingReport}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50 transition disabled:opacity-50 text-xs"
            >
              <Send className="w-4 h-4" />
              <span>{submittingReport ? 'SUBMITTING & RUNNING ML CLASSIFICATION...' : 'SUBMIT DISASTER HAZARD REPORT'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: MY SUBMITTED REPORTS & RESCUE TRACKER */}
      {activeTab === 'my_reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Personal Incident Tracking & Response Status
              </h3>
              <p className="text-xs text-slate-400">
                Track verification, AI triage rating, and emergency vehicle dispatch for your reports.
              </p>
            </div>
            <button
              onClick={fetchMyReports}
              disabled={loadingReports}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 text-xs font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingReports ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              <span>Loading your incident history...</span>
            </div>
          ) : myReports.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm">You haven't submitted any disaster reports yet.</p>
              <button
                onClick={() => setActiveTab('report')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
              >
                Submit Your First Report
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myReports.map((report) => (
                <div
                  key={report.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">
                          {report.title}
                        </span>
                        {report.is_sos === 1 && (
                          <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold">
                            SOS ALERT
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        📍 {report.location_name} • Reported at {report.created_at}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={report.severity_level} size="sm" />
                      <span
                        className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase border ${
                          report.status === 'Resolved'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : report.status === 'Dispatched'
                            ? 'bg-purple-950 text-purple-400 border-purple-800'
                            : report.status === 'Verified'
                            ? 'bg-blue-950 text-blue-400 border-blue-800'
                            : 'bg-amber-950 text-amber-400 border-amber-800'
                        }`}
                      >
                        {report.status === 'Reported' && '⏳ Under Review'}
                        {report.status === 'Verified' && '🛡️ Verified by EOC'}
                        {report.status === 'Dispatched' && '🚑 Fleet Dispatched'}
                        {report.status === 'Resolved' && '✅ Incident Resolved'}
                        {!['Reported', 'Verified', 'Dispatched', 'Resolved'].includes(report.status) && report.status}
                      </span>
                    </div>
                  </div>

                  {report.description && (
                    <p className="text-slate-300 text-xs italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                      "{report.description}"
                    </p>
                  )}

                  {report.image_url && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">EVIDENCE PHOTO:</span>
                      <a
                        href={`http://localhost:8000${report.image_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline text-xs"
                      >
                        View Photo Evidence
                      </a>
                    </div>
                  )}

                  {/* Dispatched Fleet Units Info */}
                  {report.dispatched_ambulances > 0 ||
                  report.dispatched_rescue_teams > 0 ||
                  report.dispatched_boats > 0 ||
                  report.dispatched_supplies > 0 ? (
                    <div className="bg-purple-950/30 border border-purple-800/50 rounded-lg p-3 text-xs text-purple-200">
                      <div className="font-bold mb-1.5 flex items-center gap-1.5 text-purple-300">
                        <Truck className="w-4 h-4" />
                        <span>DISPATCHED FIELD ASSETS EN ROUTE:</span>
                      </div>
                      <div className="flex flex-wrap gap-3 font-mono text-xs">
                        {report.dispatched_ambulances > 0 && <span>🚑 {report.dispatched_ambulances} Ambulances</span>}
                        {report.dispatched_rescue_teams > 0 && <span>👷 {report.dispatched_rescue_teams} Rescue Teams</span>}
                        {report.dispatched_boats > 0 && <span>🚤 {report.dispatched_boats} Rescue Boats</span>}
                        {report.dispatched_supplies > 0 && <span>📦 {report.dispatched_supplies} Relief Supplies</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>EOC Commander is evaluating resource allocation for this sector.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default CitizenDashboard;
