import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { useSensorStore } from '../stores/sensorStore';
import { useAlertStore } from '../stores/alertStore';
import { SOUND_CLASS_COLORS, SensorStatus } from '../types';
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

export default function ForestMap() {
  const { nodes, initialize } = useSensorStore();
  const { getActiveAlerts } = useAlertStore();
  const activeAlerts = getActiveAlerts();

  useEffect(() => {
    if (nodes.length === 0) {
      initialize();
    }
  }, [nodes, initialize]);

  const mapCenter: [number, number] = [21.1497, 79.0830]; // Indian forest area

  return (
    <div className="h-full w-full flex flex-col glass-card relative">
      <div className="p-4 border-b border-canopy-700 flex justify-between items-center z-10 bg-canopy-900/90 rounded-t-xl">
        <h2 className="text-xl font-bold text-gray-100">Live Forest Map</h2>
        <div className="flex gap-4 items-center">
          <div className="badge-purple">Simulated Data</div>
        </div>
      </div>
      
      <div className="flex-1 relative rounded-b-xl overflow-hidden">
        <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
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
                        <p className="text-sm mb-1">Battery: {node.battery}%</p>
                        <p className="text-sm mb-1">Zone: {node.location.zone}</p>
                        {node.detectionHistory.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            Last Event: {node.detectionHistory[0].eventClass}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Coverage Areas">
              <LayerGroup>
                {nodes.map(node => (
                  <Circle
                    key={`coverage-${node.id}`}
                    center={[node.location.lat, node.location.lng]}
                    radius={1500} // 1.5km - labeled as experimental
                    pathOptions={{
                      color: '#6b7280',
                      fillColor: '#6b7280',
                      fillOpacity: 0.1,
                      dashArray: '5, 10',
                      weight: 1
                    }}
                  >
                    <Popup>
                      <div className="bg-canopy-800 text-gray-200 p-1">
                        <p className="text-xs">Experimental/Planning Coverage</p>
                      </div>
                    </Popup>
                  </Circle>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Active Alerts">
              <LayerGroup>
                {activeAlerts.map(alert => (
                  <React.Fragment key={`alert-${alert.id}`}>
                    <Marker
                      position={[alert.location.lat, alert.location.lng]}
                      icon={createPulseIcon(SOUND_CLASS_COLORS[alert.eventClass] || '#ef4444')}
                    />
                    <Circle
                      center={[alert.location.lat, alert.location.lng]}
                      radius={300}
                      pathOptions={{
                        color: SOUND_CLASS_COLORS[alert.eventClass] || '#ef4444',
                        fillColor: SOUND_CLASS_COLORS[alert.eventClass] || '#ef4444',
                        fillOpacity: 0.2,
                        weight: 0
                      }}
                    />
                  </React.Fragment>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
            
            <LayersControl.Overlay checked name="Risk Zones">
              <LayerGroup>
                 <Circle
                    center={[21.152, 79.088]}
                    radius={800}
                    pathOptions={{
                      color: '#ef4444',
                      fillColor: '#ef4444',
                      fillOpacity: 0.1,
                      weight: 1,
                      dashArray: '4'
                    }}
                  />
              </LayerGroup>
            </LayersControl.Overlay>

          </LayersControl>
        </MapContainer>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] glass-card p-3 rounded-lg bg-canopy-900/80 border border-canopy-700 pointer-events-auto shadow-lg">
          <h4 className="text-xs font-bold text-gray-300 uppercase mb-2">Legend</h4>
          <div className="space-y-1.5 text-xs text-gray-400">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-forest-500"></div> Online Node</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Warning Node</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Critical Node</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0 border-t border-dashed border-gray-500"></div> Experimental Coverage
            </div>
          </div>
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
