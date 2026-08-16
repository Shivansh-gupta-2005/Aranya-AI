import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAlertStore } from '../stores/alertStore';
import { useSensorStore } from '../stores/sensorStore';
import { useIncidentStore } from '../stores/incidentStore';
import { SOUND_CLASS_LABELS, SOUND_CLASS_COLORS, formatTimestamp } from '../types';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Play, MapPin, Activity, Cpu } from 'lucide-react';

export default function IncidentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { alerts, updateStatus } = useAlertStore();
  const { nodes } = useSensorStore();
  const { createIncident, getIncident, updateInvestigatorNotes } = useIncidentStore();

  const [notes, setNotes] = useState('');
  const [savedMsg, setSavedMsg] = useState(false);
  
  const alert = alerts.find(a => a.id === id);
  const node = alert ? nodes.find(n => n.id === alert.sensorId) : null;
  
  useEffect(() => {
    if (alert && !getIncident(alert.id)) {
      // Create mock incident data
      const mockWaveform = Array.from({length: 100}, () => Math.random() * 2 - 1);
      const mockSpectrogram = Array.from({length: 50}, () => 
        Array.from({length: 100}, () => Math.random())
      );
      createIncident(alert, mockWaveform, mockSpectrogram);
    }
  }, [alert, createIncident, getIncident]);

  const incident = id ? getIncident(id) : null;

  if (!alert) {
    return (
      <div className="flex flex-col items-center justify-center h-full glass-card">
        <h2 className="text-xl text-gray-300">Incident not found</h2>
        <button className="btn-primary mt-4" onClick={() => navigate('/alerts')}>Return to Alerts</button>
      </div>
    );
  }

  const handleStatusChange = (status: any) => {
    updateStatus(alert.id, status);
  };

  return (
    <div className="flex flex-col gap-4 h-full w-full overflow-y-auto pb-8">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => navigate('/alerts')}
          className="p-2 glass-card rounded-full hover:bg-canopy-700 transition-colors text-gray-300"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-100">Incident Details</h1>
        {alert.isSimulated && <span className="badge-purple ml-auto">SIMULATED DATA</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-xl relative overflow-hidden">
             {alert.status === 'active' && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>}
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold" style={{color: SOUND_CLASS_COLORS[alert.eventClass] || '#fff'}}>
                  {SOUND_CLASS_LABELS[alert.eventClass]}
                </h2>
                <p className="text-gray-400 mt-1">{alert.description}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-100">{(alert.confidence * 100).toFixed(1)}%</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">AI Confidence</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`px-3 py-1 rounded border text-sm font-semibold uppercase ${
                alert.status === 'active' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                alert.status === 'acknowledged' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' :
                alert.status === 'verified' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' :
                alert.status === 'false_alarm' ? 'bg-gray-500/20 text-gray-400 border-gray-500/50' :
                'bg-green-500/20 text-green-400 border-green-500/50'
              }`}>
                Status: {alert.status.replace('_', ' ')}
              </span>
              <span className="px-3 py-1 rounded border bg-canopy-800 border-canopy-600 text-gray-300 text-sm flex items-center gap-2">
                <Activity size={14}/> Severity: {alert.severity.toUpperCase()}
              </span>
              <span className="px-3 py-1 rounded border bg-canopy-800 border-canopy-600 text-gray-300 text-sm">
                Time: {formatTimestamp(alert.timestamp)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-canopy-700 pt-6">
              {alert.status === 'active' && (
                <button onClick={() => handleStatusChange('acknowledged')} className="btn-primary bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-2">
                  <AlertTriangle size={18} /> Acknowledge
                </button>
              )}
              {(alert.status === 'active' || alert.status === 'acknowledged') && (
                <>
                  <button onClick={() => handleStatusChange('verified')} className="btn-primary bg-red-600 hover:bg-red-500 text-white flex items-center gap-2">
                    <CheckCircle size={18} /> Verify True Positive
                  </button>
                  <button onClick={() => handleStatusChange('false_alarm')} className="btn-primary bg-gray-600 hover:bg-gray-500 text-white flex items-center gap-2">
                    <XCircle size={18} /> Mark False Alarm
                  </button>
                </>
              )}
              {alert.status === 'verified' && (
                <button onClick={() => handleStatusChange('resolved')} className="btn-primary bg-green-600 hover:bg-green-500 text-white flex items-center gap-2">
                  <CheckCircle size={18} /> Resolve Incident
                </button>
              )}
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Play size={20} className="text-forest-500" /> Acoustic Analysis
            </h3>
            
            <div className="bg-canopy-900 border border-canopy-700 rounded-lg p-4 mb-4 relative h-32 flex items-center justify-center">
              {/* Mock Waveform Display */}
              <div className="absolute inset-0 flex items-center px-4">
                {incident?.waveformData?.map((val, i) => (
                  <div key={i} className="flex-1 bg-forest-500 mx-[1px]" style={{ height: `${Math.abs(val) * 100}%`, opacity: 0.7 }}></div>
                ))}
              </div>
              <div className="z-10 bg-canopy-900/80 px-3 py-1 rounded text-xs text-gray-400 font-mono">Audio Clip: {alert.eventClass}_sample.wav</div>
            </div>

            <div className="bg-canopy-900 border border-canopy-700 rounded-lg p-4 relative h-40 flex flex-col justify-end">
              {/* Mock Spectrogram Display */}
              <div className="absolute inset-0 opacity-50 bg-gradient-to-t from-canopy-900 to-transparent"></div>
               <div className="absolute inset-0 flex flex-col">
                {incident?.spectrogramData?.map((row, i) => (
                  <div key={i} className="flex-1 flex">
                     {row.map((val, j) => (
                        <div key={j} className="flex-1" style={{ backgroundColor: `rgba(34, 197, 94, ${val})`}}></div>
                     ))}
                  </div>
                ))}
              </div>
              <div className="z-10 text-xs text-gray-400 font-mono mt-auto relative">Mel Spectrogram</div>
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center justify-between">
              Verification Notes
              {savedMsg && <span className="text-xs text-green-400 animate-fade-in">Saved</span>}
            </h3>
            <textarea
              className="w-full bg-canopy-900 border border-canopy-700 rounded-lg p-3 text-gray-200 focus:outline-none focus:border-forest-500 min-h-[100px]"
              placeholder="Add investigator notes here..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSavedMsg(false);
              }}
            />
            <button
              className="btn-primary mt-2 disabled:opacity-50"
              disabled={!alert}
              onClick={() => {
                if (alert) {
                  updateInvestigatorNotes(alert.id, notes);
                  setSavedMsg(true);
                  setTimeout(() => setSavedMsg(false), 2000);
                }
              }}
            >
              Save Notes
            </button>
          </div>
        </div>

        {/* Right Column - Sensor & Meta */}
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-forest-500" /> Sensor Node
            </h3>
            {node ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-canopy-700 pb-2">
                  <span className="text-gray-400 text-sm">Node ID</span>
                  <span className="font-mono text-gray-200">{node.id}</span>
                </div>
                <div className="flex justify-between items-center border-b border-canopy-700 pb-2">
                  <span className="text-gray-400 text-sm">Name</span>
                  <span className="text-gray-200 font-semibold">{node.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-canopy-700 pb-2">
                  <span className="text-gray-400 text-sm">Battery</span>
                  <span className="text-gray-200">{node.battery}%</span>
                </div>
                 <div className="flex justify-between items-center border-b border-canopy-700 pb-2">
                  <span className="text-gray-400 text-sm">Signal</span>
                  <span className="text-gray-200">{node.signalStrength}%</span>
                </div>
                 <div className="mt-2 text-center">
                  <button className="text-forest-500 text-sm hover:underline" onClick={() => navigate(`/sensors/${node.id}`)}>
                    View Node Details
                  </button>
                </div>
              </div>
            ) : (
               <div className="text-gray-400 text-sm">Node information unavailable</div>
            )}
          </div>

          <div className="glass-card p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-forest-500" /> Location
            </h3>
             <div className="bg-canopy-900 rounded p-4 border border-canopy-700 text-center mb-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Zone</div>
                <div className="text-lg font-bold text-gray-200">{alert.location.zone}</div>
             </div>
             <div className="flex justify-between text-sm text-gray-400">
               <span>Lat: {alert.location.lat.toFixed(5)}</span>
               <span>Lng: {alert.location.lng.toFixed(5)}</span>
             </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-200 mb-4">Event Timeline</h3>
             <div className="flex flex-col gap-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-canopy-600 before:to-transparent">
                {alert.timeline.map((entry, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                     <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-canopy-800 text-slate-500 group-[.is-active]:text-emerald-50 group-[.is-active]:bg-forest-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                     <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-canopy-800 p-3 rounded-lg border border-canopy-700">
                        <div className="text-xs font-semibold text-gray-300">{entry.action}</div>
                        <div className="text-[10px] text-gray-500 mb-1">{formatTimestamp(entry.timestamp)}</div>
                        <div className="text-xs text-gray-400">{entry.detail}</div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
