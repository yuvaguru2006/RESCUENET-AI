import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export const DisasterMap = ({ mapTelemetry }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [13.0450, 80.2400],
        zoom: 11,
        zoomControl: true,
      });

      // Standard OpenStreetMap tiles (no API key required)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      // Clean up on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers and vectors when mapTelemetry changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    if (!mapTelemetry) return;

    const { incidents = [], depots = [], routes = [] } = mapTelemetry;

    // 1. Render Depots
    depots.forEach((depot) => {
      const depotIcon = L.divIcon({
        className: 'custom-depot-marker',
        html: `
          <div style="background-color: #1e3a8a; border: 2px solid #3b82f6; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6); color: white; font-weight: bold; font-family: monospace; font-size: 14px;">
            DEP
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([depot.latitude, depot.longitude], { icon: depotIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; color: #0f172a; min-width: 220px;">
          <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #1e3a8a;">
            🏢 ${depot.name}
          </h4>
          <p style="margin: 2px 0; font-size: 12px; color: #475569;">Resource Depot Inventory:</p>
          <div style="background: #f1f5f9; padding: 6px; border-radius: 4px; font-size: 11px; font-family: monospace; margin-top: 4px;">
            <div>🚑 Ambulances: <b>${depot.available_ambulances}</b> / ${depot.ambulances}</div>
            <div>👷 Rescue Teams: <b>${depot.available_rescue_teams}</b> / ${depot.rescue_teams}</div>
            <div>🚤 Rescue Boats: <b>${depot.available_boats}</b> / ${depot.boats}</div>
            <div>📦 Supplies: <b>${depot.available_supplies}</b> / ${depot.supplies}</div>
          </div>
        </div>
      `);
      layerGroup.addLayer(marker);
    });

    // 2. Render Incidents
    incidents.forEach((incident) => {
      const isCritical = incident.severity_level === 'Critical';
      const isHigh = incident.severity_level === 'High';
      const color = isCritical ? '#ef4444' : isHigh ? '#f59e0b' : incident.severity_level === 'Medium' ? '#eab308' : '#10b981';

      const incidentIcon = L.divIcon({
        className: 'custom-incident-marker',
        html: `
          <div style="position: relative; width: 34px; height: 34px;">
            <div style="position: absolute; inset: 0; background-color: ${color}; opacity: 0.35; border-radius: 50%; ${isCritical ? 'animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;' : ''}"></div>
            <div style="position: absolute; inset: 3px; background-color: #0b1329; border: 2px solid ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${color}; color: ${color}; font-weight: 800; font-size: 11px; font-family: monospace;">
              !
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([incident.latitude, incident.longitude], { icon: incidentIcon });
      
      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px; color: #0f172a; min-width: 250px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${color}20; color: ${color}; border: 1px solid ${color};">
              ${incident.severity_level.toUpperCase()} SEVERITY
            </span>
            <span style="font-size: 11px; font-weight: bold; color: #475569;">
              Risk: ${incident.risk_score}/100
            </span>
          </div>
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: #0f172a;">
            ${incident.title}
          </h4>
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">📍 ${incident.location_name}</p>
          <div style="background: #f8fafc; padding: 6px; border-radius: 4px; font-size: 11px; font-family: monospace; margin-bottom: 8px;">
            <div>Casualties: <b style="color: #dc2626;">${incident.casualties}</b></div>
            <div>Affected Pop: <b>${incident.affected_population.toLocaleString()}</b></div>
            <div>Damage Level: <b>${incident.damage_level} / 5</b></div>
            <div>Type: <b>${incident.disaster_type}</b></div>
          </div>
          <div style="font-size: 11px; font-style: italic; color: #475569; margin-bottom: 8px;">
            ${incident.prediction_explanation || ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      layerGroup.addLayer(marker);
    });

    // 3. Render Dispatch Route Vectors
    routes.forEach((route) => {
      const isDispatched = route.status === 'Dispatched';
      const polyline = L.polyline(
        [
          [route.depot.lat, route.depot.lng],
          [route.incident.lat, route.incident.lng],
        ],
        {
          color: isDispatched ? '#10b981' : '#a855f7',
          weight: 3,
          dashArray: isDispatched ? null : '6, 8',
          opacity: 0.85,
        }
      );

      polyline.bindTooltip(
        `<b>${route.status === 'Dispatched' ? 'ACTIVE DISPATCH' : 'PROPOSED DISPATCH'}</b><br/>` +
        `From: ${route.depot.name} ➔ To: ${route.incident.title}<br/>` +
        `Distance: ${route.distance_km} km<br/>` +
        `Payload: 🚑 ${route.resources.ambulances} | 👷 ${route.resources.rescue_teams} | 🚤 ${route.resources.boats} | 📦 ${route.resources.supplies}`,
        { sticky: true }
      );

      layerGroup.addLayer(polyline);
    });

  }, [mapTelemetry]);

  return (
    <div className="relative w-full h-[520px] rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Floating HUD Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 shadow-xl pointer-events-auto max-w-xs">
        <div className="font-bold text-slate-200 mb-1.5 flex items-center justify-between">
          <span>CHENNAI COMMAND MAP</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
            LIVE GIS
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span>Critical Severity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>High Severity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Medium Severity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 border border-blue-400" />
            <span>Resource Depot</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <span className="w-4 h-0.5 bg-purple-500 border-dashed" />
            <span>Proposed Vector</span>
            <span className="w-4 h-0.5 bg-emerald-500 ml-2" />
            <span>Dispatched Vector</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisasterMap;
