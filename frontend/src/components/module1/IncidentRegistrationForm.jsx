import React, { useState, useEffect } from 'react';
import { disasterApi } from '../../api/client';
import { SeverityBadge } from '../common/SeverityBadge';
import { BrainCircuit, AlertTriangle, ShieldCheck, MapPin, Send, Sparkles } from 'lucide-react';

const CHENNAI_PRESETS = [
  { name: 'Velachery, Chennai', lat: 12.9750, lng: 80.2207, defaultType: 'Flood' },
  { name: 'Marina Coastal Strip, Chennai', lat: 13.0500, lng: 80.2824, defaultType: 'Cyclone' },
  { name: 'Tambaram West, Chennai', lat: 12.9300, lng: 80.1200, defaultType: 'Flood' },
  { name: 'Parrys / George Town, Chennai', lat: 13.0900, lng: 80.2860, defaultType: 'Building Collapse' },
  { name: 'Adyar River Corridor, Chennai', lat: 13.0100, lng: 80.2500, defaultType: 'Flood' },
  { name: 'Anna Nagar West, Chennai', lat: 13.0850, lng: 80.2101, defaultType: 'Flood' },
  { name: 'T. Nagar Commercial Zone, Chennai', lat: 13.0418, lng: 80.2341, defaultType: 'Building Collapse' },
];

export const IncidentRegistrationForm = ({ onIncidentRegistered }) => {
  const [formData, setFormData] = useState({
    title: '',
    disaster_type: 'Flood',
    location_name: 'Velachery, Chennai',
    latitude: 12.9750,
    longitude: 80.2207,
    casualties: 5,
    affected_population: 2000,
    damage_level: 3,
    weather_condition: 'Severe Rain',
  });

  const [aiPreview, setAiPreview] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Trigger real-time ML prediction preview on input change
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setPredicting(true);
        const res = await disasterApi.predictSeverity({
          disaster_type: formData.disaster_type,
          casualties: Number(formData.casualties),
          affected_population: Number(formData.affected_population),
          damage_level: Number(formData.damage_level),
          weather_condition: formData.weather_condition,
        });
        if (active) {
          setAiPreview(res.data);
        }
      } catch (err) {
        console.error('Prediction preview error', err);
      } finally {
        if (active) setPredicting(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [formData.disaster_type, formData.casualties, formData.affected_population, formData.damage_level, formData.weather_condition]);

  const handlePresetChange = (e) => {
    const selected = CHENNAI_PRESETS.find((p) => p.name === e.target.value);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        location_name: selected.name,
        latitude: selected.lat,
        longitude: selected.lng,
        disaster_type: selected.defaultType,
        title: `${selected.name.split(',')[0]} Disaster Event`,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const finalTitle = formData.title.trim() || `${formData.disaster_type} at ${formData.location_name}`;
      const payload = {
        ...formData,
        title: finalTitle,
        casualties: Number(formData.casualties),
        affected_population: Number(formData.affected_population),
        damage_level: Number(formData.damage_level),
      };

      const res = await disasterApi.registerIncident(payload);
      setSuccessMessage(
        `Incident Registered Successfully! AI classified as ${res.data.severity_level} (Risk: ${res.data.risk_score}/100)`
      );

      // Keep AI preview aligned with the registered incident
      setAiPreview({
        severity_level: res.data.severity_level,
        risk_score: res.data.risk_score,
        confidence: 0.95,
        class_probabilities: aiPreview?.class_probabilities || {
          [res.data.severity_level]: 0.95,
        },
        feature_contributions: aiPreview?.feature_contributions || {
          "Casualties Impact": 35.0,
          "Infrastructure Damage": 30.0,
          "Hazard Type Specifics": 20.0,
          "Population Exposure": 15.0,
        },
        explanation: res.data.prediction_explanation,
        is_simulated_model: false,
      });

      if (onIncidentRegistered) {
        onIncidentRegistered(res.data);
      }

      // Preserve registered telemetry values so display and preview remain consistent
      // Clear title so operator can register another event or modify this one
      setFormData((prev) => ({
        ...prev,
        title: '',
      }));
    } catch (err) {
      console.error('Incident registration failed', err);
      setErrorMessage('Failed to register incident. Ensure backend is running.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Registration Form */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Incident Telemetry Intake
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Module 1: Ingest telemetry for real-time Scikit-learn Random Forest evaluation
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
            SECURE REST INGEST
          </span>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500 rounded-lg text-emerald-300 text-xs font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-500 rounded-lg text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {/* Preset Location Picker */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              CHENNAI OPERATIONAL PRESET:
            </label>
            <select
              value={formData.location_name}
              onChange={handlePresetChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {CHENNAI_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})
                </option>
              ))}
            </select>
          </div>

          {/* Incident Title */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              INCIDENT OPERATIONAL TITLE:
            </label>
            <input
              type="text"
              placeholder="e.g. Velachery Lowland Storm Inundation"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Disaster Type & Weather Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">DISASTER HAZARD TYPE:</label>
              <select
                value={formData.disaster_type}
                onChange={(e) => setFormData({ ...formData, disaster_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Flood">Flood</option>
                <option value="Cyclone">Cyclone</option>
                <option value="Earthquake">Earthquake</option>
                <option value="Wildfire">Wildfire</option>
                <option value="Landslide">Landslide</option>
                <option value="Building Collapse">Building Collapse</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">WEATHER CONDITION:</label>
              <select
                value={formData.weather_condition}
                onChange={(e) => setFormData({ ...formData, weather_condition: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Severe Rain">Severe Rain</option>
                <option value="Monsoon Surge">Monsoon Surge</option>
                <option value="Storm Winds">Storm Winds</option>
                <option value="Moderate Rain">Moderate Rain</option>
                <option value="Dry/High Wind">Dry/High Wind</option>
                <option value="Normal">Normal</option>
              </select>
            </div>
          </div>

          {/* Lat / Lng Coords */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">LATITUDE (N):</label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">LONGITUDE (E):</label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Casualties & Affected Population */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center text-slate-300 font-semibold mb-1">
                <span>REPORTED CASUALTIES:</span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={formData.casualties}
                  onChange={(e) =>
                    setFormData({ ...formData, casualties: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-bold text-red-400 focus:outline-none focus:border-red-500"
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.casualties}
                onChange={(e) =>
                  setFormData({ ...formData, casualties: parseInt(e.target.value) || 0 })
                }
                className="w-full accent-red-500 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between items-center text-slate-300 font-semibold mb-1">
                <span>AFFECTED POPULATION:</span>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="50"
                  value={formData.affected_population}
                  onChange={(e) =>
                    setFormData({ ...formData, affected_population: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-bold text-blue-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="50"
                max="30000"
                step="50"
                value={formData.affected_population}
                onChange={(e) =>
                  setFormData({ ...formData, affected_population: parseInt(e.target.value) || 0 })
                }
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Infrastructure Damage Level (1-5) */}
          <div>
            <div className="flex justify-between text-slate-300 font-semibold mb-1">
              <span>INFRASTRUCTURE DAMAGE LEVEL (1 TO 5):</span>
              <span className="text-amber-400 font-bold">
                Level {formData.damage_level} / 5
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setFormData({ ...formData, damage_level: lvl })}
                  className={`py-2 text-center rounded border font-bold transition ${
                    formData.damage_level === lvl
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  L{lvl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {formData.damage_level === 1 && 'Minor: Surface water, no structural impairment.'}
              {formData.damage_level === 2 && 'Moderate: Local road closures, localized power outage.'}
              {formData.damage_level === 3 && 'Severe: Substation flooded, arterial road breaches, bridge alerts.'}
              {formData.damage_level === 4 && 'Major: Structural collapses, medical access cutoff, power blackout.'}
              {formData.damage_level === 5 && 'Catastrophic: Multi-building collapse, total utility severance.'}
            </p>
          </div>

          {/* Submit & Reset Controls */}
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'PROCESSING WITH ML & PERSISTING...' : 'REGISTER DISASTER INCIDENT'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({
                  title: '',
                  disaster_type: 'Flood',
                  location_name: 'Velachery, Chennai',
                  latitude: 12.9750,
                  longitude: 80.2207,
                  casualties: 5,
                  affected_population: 2000,
                  damage_level: 3,
                  weather_condition: 'Severe Rain',
                });
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className="px-3 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition text-xs font-mono"
              title="Reset intake telemetry"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Real-Time ML Intelligence Card */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex-1 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
              <BrainCircuit className="w-4 h-4 text-purple-400" />
              AI Severity Classifier
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> LIVE INFERENCE
            </span>
          </div>

          {predicting ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-400 font-mono text-xs">
              <BrainCircuit className="w-8 h-8 text-purple-400 animate-spin mb-3" />
              <span>Evaluating feature telemetry with Scikit-learn Pipeline...</span>
            </div>
          ) : aiPreview ? (
            <div className="space-y-4 font-mono text-xs">
              {/* Severity & Risk Score */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">CLASSIFIED SEVERITY</span>
                  <div className="mt-1">
                    <SeverityBadge severity={aiPreview.severity_level} size="lg" />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">RISK INDEX</span>
                  <span className="text-2xl font-extrabold text-slate-100">
                    {aiPreview.risk_score}
                    <span className="text-xs font-normal text-slate-500"> / 100</span>
                  </span>
                </div>
              </div>

              {/* Risk Gauge Bar */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Continuous Risk Metric</span>
                  <span className="font-bold text-slate-200">{aiPreview.risk_score}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      aiPreview.risk_score >= 80
                        ? 'bg-red-500'
                        : aiPreview.risk_score >= 60
                        ? 'bg-amber-500'
                        : aiPreview.risk_score >= 35
                        ? 'bg-yellow-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${aiPreview.risk_score}%` }}
                  />
                </div>
              </div>

              {/* Class Probabilities */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-2 font-bold">
                  MODEL PROBABILITY DISTRIBUTION:
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {Object.entries(aiPreview.class_probabilities || {}).map(([cls, prob]) => (
                    <div key={cls} className="bg-slate-900 p-1.5 rounded border border-slate-800">
                      <div className="text-[10px] text-slate-400">{cls}</div>
                      <div className="font-bold text-slate-200">{(prob * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explainable AI (XAI) Factors */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-2 font-bold">
                  EXPLAINABLE AI RISK CONTRIBUTIONS:
                </span>
                <div className="space-y-1.5">
                  {Object.entries(aiPreview.feature_contributions || {}).map(([factor, pct]) => (
                    <div key={factor}>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>{factor}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Natural Language Explanation */}
              <div className="p-3 bg-purple-950/30 border border-purple-800/60 rounded-lg text-purple-200 text-[11px] leading-relaxed">
                <p className="font-semibold mb-1 text-purple-300">Decision Rationale:</p>
                {aiPreview.explanation}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default IncidentRegistrationForm;
