import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventStore } from '../stores/eventStore';
import { SOUND_CLASS_LABELS, SOUND_CLASS_COLORS, ALERT_DESCRIPTIONS, formatTimestamp } from '../types';
import { VerificationStatus } from '../types/event';
import { Activity, ShieldAlert, Filter, Clock } from 'lucide-react';

export default function Alerts() {
  const { events, getActiveEvents } = useEventStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<VerificationStatus | 'all'>('all');
  const [sort, setSort] = useState<'time' | 'severity' | 'confidence'>('time');

  // Alerts page = actionable/problematic events only (see
  // eventBuilder.isAlertEligible, the single source of truth for this
  // policy). Forest Ambience and other informational detections are real
  // and still visible in the audio timeline / Incident Details /
  // Analytics: just never listed here as a threat.
  const alertableEvents = events.filter((e) => e.alertEligible);
  const filteredEvents = alertableEvents.filter((e) => filter === 'all' || e.verification.status === filter);

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (sort === 'time') return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    if (sort === 'confidence') return b.confidence - a.confidence;
    const sevMap = { critical: 4, high: 3, medium: 2, low: 1 };
    return sevMap[b.severity] - sevMap[a.severity];
  });

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'active': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'acknowledged': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'verified': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'false_alarm': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <span className="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-400 border border-red-500/50">Critical</span>;
      case 'high': return <span className="px-2 py-0.5 rounded text-xs bg-orange-900/50 text-orange-400 border border-orange-500/50">High</span>;
      case 'medium': return <span className="px-2 py-0.5 rounded text-xs bg-amber-900/50 text-amber-400 border border-amber-500/50">Medium</span>;
      default: return <span className="px-2 py-0.5 rounded text-xs bg-gray-900/50 text-gray-400 border border-gray-500/50">Low</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full">
      <div className="flex justify-between items-center glass-card p-4 rounded-xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <ShieldAlert className="text-red-500" /> System Alerts
          </h1>
          <p className="text-gray-400 text-sm mt-1">Actionable events only: real detections and simulated sensor events. Forest Ambience and other informational detections are excluded (see Audio Upload timeline / Analytics).</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-center px-4 border-r border-canopy-700">
            <div className="text-2xl font-bold text-red-400">{getActiveEvents().length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Active</div>
          </div>
          <div className="text-center px-4">
            <div className="text-2xl font-bold text-gray-200">{alertableEvents.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Total Alerts</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center glass-card p-3 rounded-xl">
        <div className="flex gap-2 items-center">
          <Filter size={18} className="text-gray-400 ml-2" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-canopy-800 border border-canopy-700 text-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-forest-500"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="verified">Verified</option>
            <option value="false_alarm">False Alarm</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="bg-canopy-800 border border-canopy-700 text-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-forest-500"
          >
            <option value="time">Time (Newest)</option>
            <option value="severity">Severity</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="glass-card p-12 rounded-xl flex flex-col items-center justify-center text-center">
            <Activity size={48} className="text-gray-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-300">No alerts found</h3>
            <p className="text-gray-500 mt-2">Run Audio Upload, Live Listen, or Demo Mode to generate events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                className="glass-card p-4 rounded-xl border border-canopy-700 hover:border-forest-500/50 transition-colors cursor-pointer flex flex-col gap-3 group relative overflow-hidden"
                onClick={() => navigate(`/incidents/${event.id}`)}
              >
                {event.verification.status === 'active' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>}

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${getStatusColor(event.verification.status)}`}
                    >
                      {event.verification.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {event.isSimulated ? (
                      <span className="badge-purple text-[10px]">SIMULATED</span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-blue-900/40 text-blue-300 border-blue-700/40">
                        Real AI
                      </span>
                    )}
                  </div>
                  {getSeverityBadge(event.severity)}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-100 mt-1" style={{ color: SOUND_CLASS_COLORS[event.eventClass] }}>
                    {SOUND_CLASS_LABELS[event.eventClass]}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-1">{ALERT_DESCRIPTIONS[event.eventClass]}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-canopy-800/50 p-2 rounded border border-canopy-700/50">
                    <div className="text-xs text-gray-500">Confidence</div>
                    <div className="text-lg font-bold text-gray-200">{(event.confidence * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-canopy-800/50 p-2 rounded border border-canopy-700/50">
                    <div className="text-xs text-gray-500">Source</div>
                    <div className="text-sm font-semibold text-gray-200 truncate">
                      {event.source.sensorId ?? (event.source.type === 'upload' ? 'Audio Upload' : 'Live Mic')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 border-t border-canopy-700/50 pt-3">
                  <Clock size={14} />
                  <span>{formatTimestamp(new Date(event.detectedAt))}</span>
                  <span className="ml-auto text-forest-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    View Details {'->'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
