import React, { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ScatterChart, Scatter
} from 'recharts';
import { Activity, AlertTriangle, ShieldQuestion } from 'lucide-react';
import { useEventStore } from '../stores/eventStore';
import { useFeedbackStore, PROTOTYPE_MODEL_DESCRIPTOR } from '../stores/feedbackStore';
import { SOUND_CLASS_COLORS, SOUND_CLASS_LABELS, SEVERITY_COLORS, SoundEventClass, Severity } from '../types';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-canopy-900/90 border border-canopy-700 p-3 rounded-lg shadow-xl backdrop-blur-sm">
        <p className="text-gray-200 font-bold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color || entry.fill }}>{entry.name}</span>
            <span className="font-mono text-gray-300">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { events } = useEventStore();
  const { records, getFalsePositiveCount, getTruePositiveCount, getTotalCount } = useFeedbackStore();

  const stats = useMemo(() => {
    const byClass = new Map<SoundEventClass, number>();
    const bySeverity = new Map<Severity, number>();
    const bySource = { upload: 0, 'live-mic': 0, 'simulated-sensor': 0 };
    const confidenceBuckets = [
      { label: '<50%', min: 0, max: 0.5, count: 0 },
      { label: '50-65%', min: 0.5, max: 0.65, count: 0 },
      { label: '65-80%', min: 0.65, max: 0.8, count: 0 },
      { label: '80-90%', min: 0.8, max: 0.9, count: 0 },
      { label: '90%+', min: 0.9, max: 1.01, count: 0 },
    ];

    for (const e of events) {
      byClass.set(e.eventClass, (byClass.get(e.eventClass) ?? 0) + 1);
      bySeverity.set(e.severity, (bySeverity.get(e.severity) ?? 0) + 1);
      bySource[e.source.type] = (bySource[e.source.type] ?? 0) + 1;
      const bucket = confidenceBuckets.find((b) => e.confidence >= b.min && e.confidence < b.max);
      if (bucket) bucket.count++;
    }

    const eventsByType = Array.from(byClass.entries()).map(([type, count]) => ({
      name: SOUND_CLASS_LABELS[type],
      value: count,
      color: SOUND_CLASS_COLORS[type],
    }));

    const eventsBySeverity = Array.from(bySeverity.entries()).map(([severity, count]) => ({
      name: severity,
      value: count,
      color: SEVERITY_COLORS[severity],
    }));

    const eventsBySource = [
      { name: 'Audio Upload (real)', value: bySource.upload },
      { name: 'Live Mic (real)', value: bySource['live-mic'] },
      { name: 'Simulated Sensor', value: bySource['simulated-sensor'] },
    ];

    // Real, chronological session timeline: x = event index in upload
    // order, y = seconds into the source clip (only meaningful for
    // upload events; others plot at 0). Small/sparse by nature: this
    // reflects an actual demo session, not a synthetic 7-day trend.
    const timeline = events
      .filter((e) => e.startTime !== undefined)
      .map((e, i) => ({ index: i, startTime: e.startTime ?? 0, eventClass: e.eventClass }));

    return { eventsByType, eventsBySeverity, eventsBySource, confidenceBuckets, timeline };
  }, [events]);

  const realEventCount = events.filter((e) => !e.isSimulated).length;
  const simulatedEventCount = events.filter((e) => e.isSimulated).length;
  const alertableCount = events.filter((e) => e.alertEligible).length;
  const informationalCount = events.length - alertableCount;

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 overflow-y-auto">
      <div className="flex justify-between items-center glass-card p-4 rounded-xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="text-forest-500" /> System Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Derived from this session's actual stored events ({realEventCount} real AI detections, {simulatedEventCount} simulated sensor events): not a mock dataset.
            {' '}{alertableCount} escalated to an actionable alert, {informationalCount} informational only (e.g. Forest Ambience).
          </p>
        </div>
        <div className="badge-purple px-4 py-2 text-sm font-bold flex items-center gap-2">
           <AlertTriangle size={16} /> Prototype Dataset
        </div>
      </div>

      {events.length === 0 && (
        <div className="glass-card p-10 rounded-xl text-center text-gray-400">
          No events recorded yet in this session. Run Audio Upload, Live Listen, or Demo Mode to populate analytics.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Feedback / Model Improvement Loop */}
        <div className="glass-card p-6 rounded-xl col-span-1 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
            <ShieldQuestion size={20} className="text-purple-400" /> Feedback & Model Improvement
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-canopy-800/50 p-4 rounded-lg border border-canopy-700/50 text-center">
              <div className="text-2xl font-bold text-gray-100">{getTotalCount()}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Feedback Samples</div>
            </div>
            <div className="bg-canopy-800/50 p-4 rounded-lg border border-canopy-700/50 text-center">
              <div className="text-2xl font-bold text-red-400">{getFalsePositiveCount()}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">False Positives Logged</div>
            </div>
            <div className="bg-canopy-800/50 p-4 rounded-lg border border-canopy-700/50 text-center">
              <div className="text-2xl font-bold text-green-400">{getTruePositiveCount()}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">True Positives Confirmed</div>
            </div>
            <div className="bg-canopy-800/50 p-4 rounded-lg border border-canopy-700/50 text-center">
              <div className="text-sm font-bold text-gray-300">Not yet run</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Last Calibration</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            Deployed model: <span className="text-gray-400">{PROTOTYPE_MODEL_DESCRIPTOR}</span>. Marking an
            incident Verified/False Alarm captures a real structured feedback record (see recent entries
            below): this prototype does not retrain any model live; a production deployment would
            incorporate accumulated feedback during periodic retraining/calibration cycles.
          </p>
          {records.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-canopy-700 text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Recorded</th>
                    <th className="pb-2 pr-4 font-medium">Prediction</th>
                    <th className="pb-2 pr-4 font-medium">Confidence</th>
                    <th className="pb-2 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 8).map((r) => (
                    <tr key={r.id} className="border-b border-canopy-800/50">
                      <td className="py-2 pr-4 text-gray-400">{new Date(r.recordedAt).toLocaleTimeString()}</td>
                      <td className="py-2 pr-4 text-gray-300">{SOUND_CLASS_LABELS[r.predictedClass]}</td>
                      <td className="py-2 pr-4 text-gray-300">{(r.predictedConfidence * 100).toFixed(1)}%</td>
                      <td className={`py-2 font-semibold ${r.verdict === 'false_alarm' ? 'text-red-400' : 'text-green-400'}`}>
                        {r.verdict === 'false_alarm' ? 'False Alarm' : 'True Positive'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Events by Type */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Events by Class</h2>
          <div className="h-[250px] w-full">
            {stats.eventsByType.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">No events yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.eventsByType} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                    {stats.eventsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Events by Severity */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Events by Severity</h2>
          <div className="h-[250px] w-full">
            {stats.eventsBySeverity.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">No events yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.eventsBySeverity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#1a2420' }} />
                  <Bar dataKey="value" name="Events" radius={[4, 4, 0, 0]}>
                    {stats.eventsBySeverity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Events by Source */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Events by Source</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.eventsBySource} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#1a2420' }} />
                <Bar dataKey="value" name="Events" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">AI Confidence Distribution</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.confidenceBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" vertical={false} />
                <XAxis dataKey="label" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#1a2420' }} />
                <Bar dataKey="count" name="Events" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Events over the uploaded clip's timeline */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Detections vs. Clip Time (uploaded-audio events)</h2>
          <div className="h-[250px] w-full">
            {stats.timeline.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">No upload-sourced events yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" />
                  <XAxis dataKey="index" name="Event #" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                  <YAxis dataKey="startTime" name="Clip time (s)" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={stats.timeline} fill="#f59e0b" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
