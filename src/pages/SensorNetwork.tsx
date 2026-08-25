import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSensorStore } from '../stores/sensorStore';
import { useEventStore } from '../stores/eventStore';
import { SensorStatus } from '../types';
import { Activity, Battery, MapPin, Radio, Thermometer, Droplets, Clock } from 'lucide-react';

export default function SensorNetwork() {
  const { nodes, initialize } = useSensorStore();
  const { events } = useEventStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (nodes.length === 0) {
      initialize();
    }
  }, [nodes, initialize]);

  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const avgBattery = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.battery, 0) / nodes.length) : 0;
  const avgSignal = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + n.signalStrength, 0) / nodes.length) : 0;
  const totalEvents = events.filter((e) => e.source.type === 'simulated-sensor').length;

  const getStatusColor = (status: SensorStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'warning': return 'bg-amber-500';
      case 'critical': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'bg-green-500';
    if (level > 20) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getSignalColor = (level: number) => {
    if (level > 70) return 'bg-green-500';
    if (level > 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 overflow-y-auto">
      <div className="bg-purple-900/30 border border-purple-500/30 text-purple-200 p-3 rounded-lg flex items-center justify-center gap-2 text-sm">
        <Activity size={16} /> All nodes displayed are part of the prototype simulation network
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Network Status</div>
          <div className="text-3xl font-bold text-gray-100">{onlineNodes} / {nodes.length}</div>
          <div className="text-xs text-green-400 mt-1">Nodes Online</div>
        </div>
        <div className="glass-card p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Avg Battery</div>
          <div className="text-3xl font-bold text-gray-100">{avgBattery}%</div>
          <div className="w-full bg-canopy-800 h-1.5 mt-2 rounded overflow-hidden">
            <div className={`h-full ${getBatteryColor(avgBattery)}`} style={{width: `${avgBattery}%`}}></div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Avg Signal</div>
          <div className="text-3xl font-bold text-gray-100">{avgSignal}%</div>
          <div className="w-full bg-canopy-800 h-1.5 mt-2 rounded overflow-hidden">
            <div className={`h-full ${getSignalColor(avgSignal)}`} style={{width: `${avgSignal}%`}}></div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Total Events</div>
          <div className="text-3xl font-bold text-gray-100">{totalEvents}</div>
          <div className="text-xs text-purple-400 mt-1">Simulated Detections</div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-200 mt-2">Active Sensor Nodes</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.map(node => (
          <div 
            key={node.id} 
            onClick={() => navigate(`/sensors/${node.id}`)}
            className="glass-card p-5 rounded-xl border border-canopy-700 hover:border-forest-500/50 cursor-pointer transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-100 group-hover:text-forest-400 transition-colors">{node.name}</h3>
                <div className="text-xs font-mono text-gray-500">{node.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 capitalize">{node.status}</span>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(node.status)} shadow-[0_0_8px_currentColor] opacity-80`}></div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 bg-canopy-900/50 p-2 rounded">
              <MapPin size={14} className="text-forest-500" /> {node.location.zone}
            </div>

            <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Battery size={14} /> Battery
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-200">{node.battery}%</span>
                  <div className="flex-1 bg-canopy-800 h-1.5 rounded overflow-hidden">
                    <div className={`h-full ${getBatteryColor(node.battery)}`} style={{width: `${node.battery}%`}}></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Radio size={14} /> Signal
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-200">{node.signalStrength}%</span>
                  <div className="flex-1 bg-canopy-800 h-1.5 rounded overflow-hidden">
                    <div className={`h-full ${getSignalColor(node.signalStrength)}`} style={{width: `${node.signalStrength}%`}}></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Thermometer size={14} className="text-amber-500" /> {node.temperature}°C
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Droplets size={14} className="text-blue-500" /> {node.humidity}%
              </div>
            </div>

            <div className="border-t border-canopy-700/50 pt-3 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Clock size={12} /> Last sync: {node.lastHeartbeat.toLocaleTimeString()}
              </div>
              <div className="text-forest-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Details -&gt;
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
