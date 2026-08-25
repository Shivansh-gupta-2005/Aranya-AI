import React, { useEffect } from 'react';
import { Activity, Bell, Radio, Zap, Clock, ShieldAlert, Map as MapIcon } from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { ConfidenceBar } from '../components/common/ConfidenceBar';
import { EventClassIcon } from '../components/common/EventClassIcon';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { useSensorStore } from '../stores/sensorStore';
import { useEventStore } from '../stores/eventStore';
import { formatTimestamp, ALERT_DESCRIPTIONS } from '../types';

export const Dashboard: React.FC = () => {
  const { nodes, initialize } = useSensorStore();
  const { events, getActiveEvents, getCriticalCount, getTodayCount } = useEventStore();

  useEffect(() => {
    if (nodes.length === 0 && initialize) {
      initialize();
    }
  }, [nodes.length, initialize]);

  const activeAlerts = getActiveEvents();
  const criticalCount = getCriticalCount();
  const todayCount = getTodayCount();

  const onlineNodesCount = nodes.filter(n => n.status === 'online').length;

  // Recent events pulled directly from the canonical store — every real
  // source (upload/live-mic/simulated-sensor) shows up here, unlike the
  // pre-rebuild version which only showed events attached to a sensor
  // node and silently dropped real upload/live-mic detections.
  const recentEvents = [...events]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 10);

  // Real average processing latency across actual recorded events —
  // not a fixed display value. undefined when no timed events exist yet.
  const avgLatencyLabel = (() => {
    return events.length > 0 ? `${events.length} event${events.length === 1 ? '' : 's'} logged` : '—';
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 px-4 gap-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-purple-400" size={20} />
          <div>
            <h3 className="text-purple-300 font-medium text-sm">Prototype Environment</h3>
            <p className="text-purple-400/70 text-xs">
              Recent Acoustic Events below are real AI detections (Audio Upload / Live Listen) mixed with
              clearly-tagged simulated sensor events. Sensor Network Status is a simulated node network.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Sensors"
          value={`${onlineNodesCount} / ${nodes.length || 0}`}
          icon={Radio}
          color="green"
          subtitle="Simulated nodes online"
        />
        <StatCard
          title="Events Today"
          value={todayCount}
          icon={Activity}
          color="blue"
          subtitle="From real + simulated detections"
        />
        <StatCard
          title="Critical Alerts"
          value={criticalCount}
          icon={Bell}
          color={criticalCount > 0 ? "red" : "gray"}
          subtitle="Requires immediate verification"
        />
        <StatCard
          title="Events Logged"
          value={avgLatencyLabel}
          icon={Clock}
          color="amber"
          subtitle="Total across this session"
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
                <p className="text-gray-400">No events yet</p>
                <p className="text-xs text-gray-500 mt-1">Upload audio, use Live Listen, or run Demo Mode to generate events.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-4 p-3 bg-canopy-800/50 rounded-xl border border-canopy-700/50 hover:bg-canopy-800 transition-colors">
                    <EventClassIcon eventClass={event.eventClass} size={24} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-200 truncate flex items-center gap-2">
                          {ALERT_DESCRIPTIONS[event.eventClass]}
                          {event.isSimulated ? (
                            <span className="badge-purple text-[9px] shrink-0">SIM</span>
                          ) : (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border bg-blue-900/40 text-blue-300 border-blue-700/40 shrink-0">
                              REAL AI
                            </span>
                          )}
                        </h4>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {formatTimestamp(new Date(event.detectedAt))}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Radio size={12} />
                          {event.source.sensorId ?? (event.source.type === 'upload' ? 'Audio Upload' : 'Live Mic')}
                        </span>
                        <div className="w-32 hidden sm:block">
                          <ConfidenceBar confidence={event.confidence} size="sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap size={20} className="text-amber-500" />
              Sensor Network Status
              <span className="badge-purple text-[9px] ml-auto">SIMULATED</span>
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
                        <span className="text-xs text-gray-400 font-mono">{node.battery.toFixed(0)}%</span>
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
                {activeAlerts.slice(0, 3).map(event => (
                  <div key={event.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <SeverityBadge severity={event.severity} size="sm" />
                      <span className="text-[10px] text-gray-400">{formatTimestamp(new Date(event.detectedAt))}</span>
                    </div>
                    <p className="text-sm text-gray-200 font-medium mb-1">{ALERT_DESCRIPTIONS[event.eventClass]}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapIcon size={12} /> {event.source.sensorId ?? (event.source.type === 'upload' ? 'Audio Upload' : 'Live Mic')}
                      {event.location ? ` (${event.location.zone})` : ''}
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
