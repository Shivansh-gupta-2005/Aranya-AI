import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSensorStore } from '../stores/sensorStore';
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Battery, Radio, Thermometer, Droplets, Clock, Activity, AlertTriangle } from 'lucide-react';
import { SOUND_CLASS_LABELS, SOUND_CLASS_COLORS, formatTimestamp, SensorStatus } from '../types';

const getStatusColor = (status: SensorStatus) => {
  switch (status) {
    case 'online': return '#22c55e';
    case 'warning': return '#f59e0b';
    case 'critical': return '#ef4444';
    case 'offline': return '#6b7280';
  }
};

const createCustomIcon = (status: SensorStatus) => {
  const color = getStatusColor(status);
  return L.divIcon({
    className: 'custom-sensor-marker-mini',
    html: `<div style="width: 16px; height: 16px; background-color: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export default function SensorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { nodes, initialize, forceSync } = useSensorStore();
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    if (nodes.length === 0) {
      initialize();
    }
  }, [nodes, initialize]);

  const node = nodes.find(n => n.id === id);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full glass-card">
        <h2 className="text-xl text-gray-300">Sensor not found</h2>
        <button className="btn-primary mt-4" onClick={() => navigate('/sensors')}>Return to Network</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 overflow-y-auto">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => navigate('/sensors')}
          className="p-2 glass-card rounded-full hover:bg-canopy-700 transition-colors text-gray-300"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-100">Node Details: {node.name}</h1>
        {node.isSimulated && <span className="badge-purple ml-auto">Simulated Sensor</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-xl flex items-center justify-between">
             <div>
                <h2 className="text-3xl font-bold text-gray-100">{node.id}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-400 capitalize">Status:</span>
                  <span className="font-semibold uppercase tracking-wider text-sm" style={{color: getStatusColor(node.status)}}>
                    {node.status}
                  </span>
                  <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] ml-2 animate-pulse`} style={{backgroundColor: getStatusColor(node.status)}}></div>
                </div>
             </div>
             <div className="text-right">
                <div className="text-sm text-gray-500 uppercase tracking-wider mb-1">Uptime</div>
                <div className="text-2xl font-mono text-gray-200">{node.uptime}h</div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="glass-card p-4 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-gray-400 text-sm"><Battery size={16}/> Battery</div>
                <div className="text-2xl font-bold text-gray-100">{node.battery}%</div>
                <div className="w-full bg-canopy-800 h-1.5 rounded overflow-hidden">
                  <div className="h-full bg-green-500" style={{width: `${node.battery}%`}}></div>
                </div>
             </div>
             <div className="glass-card p-4 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-gray-400 text-sm"><Radio size={16}/> Signal</div>
                <div className="text-2xl font-bold text-gray-100">{node.signalStrength}%</div>
                <div className="w-full bg-canopy-800 h-1.5 rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{width: `${node.signalStrength}%`}}></div>
                </div>
             </div>
             <div className="glass-card p-4 rounded-xl flex flex-col justify-center">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><Thermometer size={16} className="text-amber-500"/> Temp</div>
                <div className="text-2xl font-bold text-gray-100">{node.temperature}°C</div>
             </div>
              <div className="glass-card p-4 rounded-xl flex flex-col justify-center">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><Droplets size={16} className="text-blue-400"/> Humidity</div>
                <div className="text-2xl font-bold text-gray-100">{node.humidity}%</div>
             </div>
          </div>

          <div className="glass-card p-6 rounded-xl flex-1">
             <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Activity size={18} className="text-forest-500" /> Detection History
            </h3>
            
            {node.detectionHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <AlertTriangle size={24} className="mb-2 opacity-50" />
                <p>No recent detections at this node.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-canopy-700 text-gray-400 text-sm">
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium">Event Class</th>
                      <th className="pb-2 font-medium">Confidence</th>
                      <th className="pb-2 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {node.detectionHistory.map(evt => (
                      <tr key={evt.id} className="border-b border-canopy-800/50 hover:bg-canopy-800/20 transition-colors">
                        <td className="py-3 text-sm text-gray-300">{formatTimestamp(evt.timestamp)}</td>
                        <td className="py-3 font-medium" style={{color: SOUND_CLASS_COLORS[evt.eventClass] || '#fff'}}>
                          {SOUND_CLASS_LABELS[evt.eventClass]}
                        </td>
                        <td className="py-3 text-gray-300">{(evt.confidence * 100).toFixed(1)}%</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider ${
                            evt.severity === 'critical' ? 'bg-red-900/50 text-red-400' :
                            evt.severity === 'high' ? 'bg-orange-900/50 text-orange-400' :
                            evt.severity === 'medium' ? 'bg-amber-900/50 text-amber-400' :
                            'bg-gray-900/50 text-gray-400'
                          }`}>
                            {evt.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="flex flex-col gap-6">
          <div className="glass-card p-4 rounded-xl h-64 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full z-0">
               <MapContainer 
                  center={[node.location.lat, node.location.lng]} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  dragging={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  <Marker position={[node.location.lat, node.location.lng]} icon={createCustomIcon(node.status)} />
                  <Circle
                    center={[node.location.lat, node.location.lng]}
                    radius={1500}
                    pathOptions={{ color: '#6b7280', fillColor: '#6b7280', fillOpacity: 0.1, dashArray: '5, 5', weight: 1 }}
                  />
                </MapContainer>
             </div>
             <div className="relative z-10 pointer-events-none w-full h-full flex flex-col justify-end pb-2">
                <div className="bg-canopy-900/90 backdrop-blur-sm p-3 rounded-lg border border-canopy-700 pointer-events-auto">
                   <div className="text-xs text-gray-400 mb-1">Location Zone</div>
                   <div className="font-bold text-gray-200">{node.location.zone}</div>
                   <div className="text-xs text-gray-500 mt-1">{node.location.lat.toFixed(5)}, {node.location.lng.toFixed(5)}</div>
                </div>
             </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-forest-500" /> Connectivity Log
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <div>
                  <div className="text-sm font-semibold text-gray-200">Last Heartbeat</div>
                  <div className="text-xs text-gray-400">{formatTimestamp(node.lastHeartbeat)}</div>
                </div>
              </div>
               <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <div>
                  <div className="text-sm font-semibold text-gray-200">Sync Status</div>
                  <div className="text-xs text-gray-400">Parameters synchronized</div>
                </div>
              </div>
               <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <div>
                  <div className="text-sm font-semibold text-gray-200">AI Model Version</div>
                  <div className="text-xs text-gray-400">MobileNetV3-Edge (v2.4)</div>
                </div>
              </div>
            </div>
            <button
              className="w-full btn-primary mt-6 text-sm disabled:opacity-50 disabled:cursor-wait"
              disabled={syncing || !node}
              onClick={() => {
                if (!node) return;
                setSyncing(true);
                setTimeout(() => {
                  forceSync(node.id);
                  setSyncing(false);
                  setLastSynced(new Date());
                }, 800);
              }}
            >
              {syncing ? 'Syncing...' : lastSynced ? `Synced ${lastSynced.toLocaleTimeString()}` : 'Force Sync Node'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
