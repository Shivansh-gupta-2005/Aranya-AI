import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { useSensorStore } from '../stores/sensorStore';
import { useEventStore } from '../stores/eventStore';
import { SOUND_CLASS_COLORS, SOUND_CLASS_LABELS, SensorStatus } from '../types';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getStatusColor = (status: SensorStatus) => {
  switch (status) {
    case 'online': return '#22c55e'; // green
    case 'warning': return '#f59e0b'; // amber
    case 'critical': return '#ef4444'; // red
    case 'offline': return '#6b7280'; // gray
  }
};

const createCustomIcon = (status: SensorStatus, name: string) => {
  const color = getStatusColor(status);
  return L.divIcon({
    className: 'custom-sensor-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="
          width: 16px;
          height: 16px;
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 10px ${color};
        "></div>
        <span style="
          margin-top: 4px;
          color: white;
          font-size: 10px;
          background: rgba(0,0,0,0.7);
          padding: 2px 4px;
          border-radius: 4px;
          white-space: nowrap;
        ">${name}</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 8],
  });
};

const createPulseIcon = (color: string) => {
  return L.divIcon({
    className: 'pulse-marker',
    html: `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          background-color: ${color};
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        "></div>
        <div style="
          position: absolute;
          top: 25%;
          left: 25%;
          width: 50%;
          height: 50%;
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3); opacity: 0; }
        }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createLocalizationIcon = () => {
  return L.divIcon({
    className: 'localization-marker',
    html: `<div style="width: 14px; height: 14px; background: #a855f7; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 12px #a855f7;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

// Illustrative acoustic-coverage radius. This is a rough planning
// assumption, NOT a precise detection boundary: actual range depends on
// sound type/intensity, terrain, vegetation, wind, humidity, background
// noise, and sensor sensitivity. Area shown wherever needed uses the
// correct pi * r^2 formula: see the tooltip text below.
const COVERAGE_RADIUS_METERS = 1500;
const coverageAreaKm2 = (Math.PI * (COVERAGE_RADIUS_METERS / 1000) ** 2).toFixed(2);

export default function ForestMap() {
  const { nodes, initialize } = useSensorStore();
  const { getActiveEvents } = useEventStore();
  const activeEvents = getActiveEvents();

  // Only events with a real location (simulated-sensor sourced, at the
  // reporting node's own coordinate) can be plotted: real upload/live-mic
  // events have no GPS and are never assigned a fabricated placeholder.
  const locatableEvents = activeEvents.filter((e) => e.location);
  const simulatedLocalizationEvents = activeEvents.filter((e) => e.localization.status === 'simulated');

  useEffect(() => {
    if (nodes.length === 0) {
      initialize();
    }
  }, [nodes, initialize]);

  const mapCenter: [number, number] = [21.1497, 79.0830]; // Indian forest area

  return (
    <div className="h-full min-h-[600px] w-full flex flex-col glass-card relative">
      <div className="p-4 border-b border-canopy-700 flex justify-between items-center z-10 bg-canopy-900/90 rounded-t-xl">
        <h2 className="text-xl font-bold text-gray-100">Live Forest Map</h2>
        <div className="flex gap-4 items-center">
          <div className="badge-purple">Simulated Sensor Network</div>
        </div>
      </div>

      <div className="flex-1 min-h-[520px] relative rounded-b-xl overflow-hidden">
        <MapContainer center={mapCenter} zoom={15} style={{ height: '600px', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; <a href='https://carto.com/'>Carto</a>"
          />

          <LayersControl position="topright">
            <LayersControl.Overlay checked name="Sensor Nodes">
              <LayerGroup>
                {nodes.map(node => (
                  <Marker
                    key={node.id}
                    position={[node.location.lat, node.location.lng]}
                    icon={createCustomIcon(node.status, node.name)}
                  >
                    <Popup className="dark-popup">
                      <div className="p-2 bg-canopy-800 text-gray-200 rounded">
                        <h3 className="font-bold border-b border-canopy-700 pb-1 mb-2">{node.name}</h3>
                        <p className="text-sm mb-1">Status: <span style={{color: getStatusColor(node.status)}}>{node.status.toUpperCase()}</span></p>
                        <p className="text-sm mb-1">Battery: {node.battery.toFixed(0)}%</p>
                        <p className="text-sm mb-1">Zone: {node.location.zone}</p>
                        <p className="text-xs text-gray-500 mt-2">Simulated prototype node</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Estimated Acoustic Coverage">
              <LayerGroup>
                {nodes.map(node => (
                  <Circle
                    key={`coverage-${node.id}`}
                    center={[node.location.lat, node.location.lng]}
                    radius={COVERAGE_RADIUS_METERS}
                    pathOptions={{
                      color: '#6b7280',
                      fillColor: '#6b7280',
                      fillOpacity: 0.08,
                      dashArray: '5, 10',
                      weight: 1
                    }}
                  >
                    <Popup>
                      <div className="bg-canopy-800 text-gray-200 p-1 text-xs">
                        <p className="font-semibold mb-1">Illustrative coverage assumption</p>
                        <p>Radius: {(COVERAGE_RADIUS_METERS / 1000).toFixed(1)} km | Area: about {coverageAreaKm2} km^2</p>
                        <p className="text-gray-400 mt-1">
                          Not a precision detection boundary: real range depends on sound type, terrain,
                          vegetation, wind, humidity and sensor sensitivity.
                        </p>
                      </div>
                    </Popup>
                  </Circle>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Active Events (with location)">
              <LayerGroup>
                {locatableEvents.map(event => (
                  <React.Fragment key={`event-${event.id}`}>
                    <Marker
                      position={[event.location!.lat, event.location!.lng]}
                      icon={createPulseIcon(SOUND_CLASS_COLORS[event.eventClass] || '#ef4444')}
                    >
                      <Popup>
                        <div className="bg-canopy-800 text-gray-200 p-1 text-xs">
                          <p className="font-semibold">{SOUND_CLASS_LABELS[event.eventClass]}</p>
                          <p>{(event.confidence * 100).toFixed(0)}% confidence | simulated sensor report</p>
                        </div>
                      </Popup>
                    </Marker>
                    <Circle
                      center={[event.location!.lat, event.location!.lng]}
                      radius={300}
                      pathOptions={{
                        color: SOUND_CLASS_COLORS[event.eventClass] || '#ef4444',
                        fillColor: SOUND_CLASS_COLORS[event.eventClass] || '#ef4444',
                        fillOpacity: 0.2,
                        weight: 0
                      }}
                    />
                  </React.Fragment>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Simulated Multi-Node Localization">
              <LayerGroup>
                {simulatedLocalizationEvents.map((event) => {
                  const loc = event.localization;
                  if (loc.status !== 'simulated') return null;
                  return (
                    <React.Fragment key={`loc-${event.id}`}>
                      <Marker position={[loc.estimatedLat, loc.estimatedLng]} icon={createLocalizationIcon()}>
                        <Popup>
                          <div className="bg-canopy-800 text-gray-200 p-1 text-xs max-w-[200px]">
                            <p className="font-semibold text-purple-300 mb-1">SIMULATED LOCALIZATION</p>
                            <p>{loc.description}</p>
                            <p className="text-gray-400 mt-1">+/- {loc.uncertaintyMeters}m | {(loc.confidence * 100).toFixed(0)}% localization confidence</p>
                            <p className="text-gray-500 mt-1">Nodes: {loc.contributingSensorIds.join(', ')}</p>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle
                        center={[loc.estimatedLat, loc.estimatedLng]}
                        radius={loc.uncertaintyMeters}
                        pathOptions={{ color: '#a855f7', fillColor: '#a855f7', fillOpacity: 0.12, dashArray: '3,6', weight: 1.5 }}
                      />
                    </React.Fragment>
                  );
                })}
              </LayerGroup>
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] glass-card p-3 rounded-lg bg-canopy-900/80 border border-canopy-700 pointer-events-auto shadow-lg max-w-[260px]">
          <h4 className="text-xs font-bold text-gray-300 uppercase mb-2">Legend</h4>
          <div className="space-y-1.5 text-xs text-gray-400">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-forest-500"></div> Online Node</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Warning Node</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Critical Node</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0 border-t border-dashed border-gray-500"></div> Illustrative coverage
            </div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Simulated localization</div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3 pt-2 border-t border-canopy-700/50 leading-relaxed">
            Localization requires multiple synchronized sensors detecting the same event (production
            capability). Run Demo Mode's "Full Forest Incident" to see a simulated example.
          </p>
        </div>
      </div>
      <style>{`
        .dark-popup .leaflet-popup-content-wrapper,
        .dark-popup .leaflet-popup-tip {
          background-color: #111916;
          color: #e5e7eb;
        }
        .dark-popup .leaflet-popup-content {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
