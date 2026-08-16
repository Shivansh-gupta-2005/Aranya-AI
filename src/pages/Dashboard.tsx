import React, { useEffect } from 'react';
import { Activity, Bell, Radio, Zap, Clock, ShieldAlert, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { ConfidenceBar } from '../components/common/ConfidenceBar';
import { EventClassIcon } from '../components/common/EventClassIcon';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { SimulatedBadge } from '../components/common/SimulatedBadge';
import { useSensorStore } from '../stores/sensorStore';
import { useAlertStore } from '../stores/alertStore';
import { formatTimestamp, ALERT_DESCRIPTIONS } from '../types';

export const Dashboard: React.FC = () => {
  const { nodes, initialize } = useSensorStore();
  const { alerts, getActiveAlerts, getCriticalCount, getTodayCount } = useAlertStore();

  useEffect(() => {
    if (nodes.length === 0 && initialize) {
      initialize();
    }
  }, [nodes.length, initialize]);

  const activeAlerts = getActiveAlerts ? getActiveAlerts() : [];
  const criticalCount = getCriticalCount ? getCriticalCount() : 0;
  const todayCount = getTodayCount ? getTodayCount() : 0;

  const onlineNodesCount = nodes.filter(n => n.status === 'online').length;
  
  const allEvents = nodes.flatMap(n => n.detectionHistory || []);
  const recentEvents = [...allEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 px-4 gap-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-purple-400" size={20} />
          <div>
            <h3 className="text-purple-300 font-medium text-sm">Prototype Environment</h3>
            <p className="text-purple-400/70 text-xs">All acoustic models and sensor data displayed are simulated for demonstration purposes.</p>
          </div>
        </div>
        <SimulatedBadge />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Active Sensors" 
          value={`${onlineNodesCount} / ${nodes.length || 0}`}
          icon={Radio}
          color="green"
          subtitle="Nodes communicating in last 5m"
        />
        <StatCard 
          title="Events Today" 
          value={todayCount}
          icon={Activity}
          color="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard 
          title="Critical Alerts" 
          value={criticalCount}
          icon={Bell}
          color={criticalCount > 0 ? "red" : "gray"}
          subtitle="Requires immediate verification"
        />
        <StatCard 
          title="Avg Latency" 
          value="1.2s"
          icon={Clock}
          color="amber"
          subtitle="Audio capture to classification"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity size={20} className="text-forest-500" />
              Recent Acoustic Events
            </h2>
            
            {recentEvents.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-canopy-700 rounded-xl">
                <Activity className="mx-auto text-gray-600 mb-3" size={32} />
                <p className="text-gray-400">No recent events detected</p>
                <p className="text-xs text-gray-500 mt-1">Waiting for sensor data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEvents.map(event => {
                  const node = nodes.find(n => n.id === event.sensorId);
                  return (
                    <div key={event.id} className="flex items-center gap-4 p-3 bg-canopy-800/50 rounded-xl border border-canopy-700/50 hover:bg-canopy-800 transition-colors">
                      <EventClassIcon eventClass={event.eventClass} size={24} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-200 truncate">
                            {ALERT_DESCRIPTIONS[event.eventClass]}
                          </h4>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                            {formatTimestamp(new Date(event.timestamp))}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Radio size={12} />
                            {node?.name || event.sensorId}
                          </span>
                          <div className="w-32 hidden sm:block">
                            <ConfidenceBar confidence={event.confidence} size="sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap size={20} className="text-amber-500" />
              Sensor Network Status
            </h2>
            
            {nodes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Initializing network...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {nodes.slice(0, 5).map(node => (
                  <div key={node.id} className="flex items-center justify-between p-3 bg-canopy-800/30 rounded-lg border border-canopy-800">
                    <div className="flex items-center gap-3">
                      <StatusIndicator status={node.status} />
                      <div>
                        <p className="text-sm font-medium text-gray-200">{node.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">ID: {node.id.split('-')[0]}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <Zap size={12} className={node.battery < 20 ? 'text-red-500' : 'text-forest-500'} />
                        <span className="text-xs text-gray-400 font-mono">{node.battery}%</span>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {node.uptime}h uptime
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-6 border-red-500/20">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-500" />
              Active Alerts
            </h2>
            
            {activeAlerts.length === 0 ? (
              <div className="text-center py-6 bg-forest-500/5 rounded-lg border border-forest-500/10">
                <p className="text-forest-400 text-sm">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeAlerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <SeverityBadge severity={alert.severity} size="sm" />
                      <span className="text-[10px] text-gray-400">{formatTimestamp(new Date(alert.timestamp))}</span>
                    </div>
                    <p className="text-sm text-gray-200 font-medium mb-1">{alert.description}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapIcon size={12} /> {alert.sensorName} ({alert.location.zone})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
