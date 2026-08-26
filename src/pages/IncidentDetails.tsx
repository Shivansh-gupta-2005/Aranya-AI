import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEventStore } from '../stores/eventStore';
import { useSensorStore } from '../stores/sensorStore';
import { recordVerification } from '../app/commands/eventCommands';
import { PROTOTYPE_MODEL_DESCRIPTOR } from '../stores/feedbackStore';
import { SOUND_CLASS_LABELS, SOUND_CLASS_COLORS, formatTimestamp } from '../types';
import { VerificationStatus } from '../types/event';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Play, MapPin, Activity, Cpu, ShieldQuestion, Radio } from 'lucide-react';

export default function IncidentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEvent, updateVerification } = useEventStore();
  const { nodes } = useSensorStore();

  const [notes, setNotes] = useState('');
  const [savedMsg, setSavedMsg] = useState(false);

  const event = id ? getEvent(id) : undefined;
  const node = event?.source.sensorId ? nodes.find((n) => n.id === event.source.sensorId) : null;

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-full glass-card">
        <h2 className="text-xl text-gray-300">Incident not found</h2>
        <button className="btn-primary mt-4" onClick={() => navigate('/alerts')}>Return to Alerts</button>
      </div>
    );
  }

  const handleStatusChange = (status: VerificationStatus) => {
    // recordVerification updates the event AND, for a real verdict
    // (verified/false_alarm), captures a structured FeedbackRecord :
    // the prototype's actual implementation of the feedback loop.
    recordVerification(event, status, undefined, 'Operator');
  };

  const displayLabel = SOUND_CLASS_LABELS[event.eventClass];
  const color = SOUND_CLASS_COLORS[event.eventClass];

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
        {!event.alertEligible && (
          <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-gray-700/40 text-gray-300 border-gray-600/50">
            Informational: Not an Alert
          </span>
        )}
        {event.isSimulated && <span className={`badge-purple ${event.alertEligible ? 'ml-auto' : ''}`}>SIMULATED SENSOR EVENT</span>}
        {!event.isSimulated && (
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-blue-900/40 text-blue-300 border-blue-700/40 ${event.alertEligible ? 'ml-auto' : ''}`}>
            Real AI Detection ({event.source.type === 'upload' ? 'Audio Upload' : 'Live Mic'})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-xl relative overflow-hidden">
             {event.alertEligible && event.verification.status === 'active' && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>}

            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold" style={{color}}>
                  {displayLabel}
                </h2>
                <p className="text-gray-400 mt-1">{event.audioReference}</p>
                {event.interpretationNote && (
                  <p className="text-amber-400/90 text-xs mt-2 flex items-start gap-1.5 max-w-xl">
                    <ShieldQuestion size={14} className="shrink-0 mt-0.5" /> {event.interpretationNote}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-100">{(event.confidence * 100).toFixed(1)}%</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Model Confidence</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`px-3 py-1 rounded border text-sm font-semibold uppercase ${
                event.verification.status === 'active' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                event.verification.status === 'acknowledged' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' :
                event.verification.status === 'verified' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' :
                event.verification.status === 'false_alarm' ? 'bg-gray-500/20 text-gray-400 border-gray-500/50' :
                'bg-green-500/20 text-green-400 border-green-500/50'
              }`}>
                Status: {event.verification.status.replace('_', ' ')}
              </span>
              <span className="px-3 py-1 rounded border bg-canopy-800 border-canopy-600 text-gray-300 text-sm flex items-center gap-2">
                <Activity size={14}/> Severity: {event.severity.toUpperCase()}
              </span>
              <span className="px-3 py-1 rounded border bg-canopy-800 border-canopy-600 text-gray-300 text-sm">
                Detected: {formatTimestamp(new Date(event.detectedAt))}
              </span>
              {event.timingPrecision === 'approximate' && (
                <span className="px-3 py-1 rounded border bg-amber-950/40 border-amber-800/50 text-amber-400 text-xs">
                  ~ approximate timing
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-canopy-700 pt-6">
              {event.verification.status === 'active' && (
                <button onClick={() => handleStatusChange('acknowledged')} className="btn-primary bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-2">
                  <AlertTriangle size={18} /> Acknowledge
                </button>
              )}
              {(event.verification.status === 'active' || event.verification.status === 'acknowledged') && (
                <>
                  <button onClick={() => handleStatusChange('verified')} className="btn-primary bg-red-600 hover:bg-red-500 text-white flex items-center gap-2">
                    <CheckCircle size={18} /> Verify True Positive
                  </button>
                  <button onClick={() => handleStatusChange('false_alarm')} className="btn-primary bg-gray-600 hover:bg-gray-500 text-white flex items-center gap-2">
                    <XCircle size={18} /> Mark False Alarm
                  </button>
                </>
              )}
              {event.verification.status === 'verified' && (
                <button onClick={() => handleStatusChange('resolved')} className="btn-primary bg-green-600 hover:bg-green-500 text-white flex items-center gap-2">
                  <CheckCircle size={18} /> Resolve Incident
                </button>
              )}
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Play size={20} className="text-forest-500" /> Acoustic Evidence
            </h3>

            {event.evidence?.waveform && event.evidence.waveform.length > 0 ? (
              <>
                <div className="bg-canopy-900 border border-canopy-700 rounded-lg p-4 mb-4 relative h-32 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center px-4">
                    {event.evidence.waveform.map((val, i) => (
                      <div key={i} className="flex-1 bg-forest-500 mx-[1px]" style={{ height: `${Math.abs(val) * 100}%`, opacity: 0.7 }}></div>
                    ))}
                  </div>
                  <div className="z-10 bg-canopy-900/80 px-3 py-1 rounded text-xs text-gray-400 font-mono">
                    Real waveform slice: {event.audioReference}
                  </div>
                </div>

                {event.evidence.spectrogram && event.evidence.spectrogram.length > 0 && (
                  <div className="bg-canopy-900 border border-canopy-700 rounded-lg p-4 relative h-40 flex flex-col justify-end">
                    <div className="absolute inset-0 flex flex-col">
                      {event.evidence.spectrogram.map((row, i) => (
                        <div key={i} className="flex-1 flex">
                          {row.map((val, j) => (
                            <div key={j} className="flex-1" style={{ backgroundColor: `rgba(34, 197, 94, ${val})` }}></div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="z-10 text-xs text-gray-400 font-mono mt-auto relative">Real log-magnitude spectrogram slice</div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-canopy-900 border border-dashed border-canopy-700 rounded-lg p-8 text-center text-gray-500 text-sm">
                Evidence unavailable {event.isSimulated ? ': this is a simulated sensor telemetry event with no associated audio.' : ''}
              </div>
            )}
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <ShieldQuestion size={18} className="text-purple-400" /> Model Feedback
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between border-b border-canopy-700 pb-2 col-span-2 sm:col-span-1">
                <span className="text-gray-500">Prediction</span>
                <span className="text-gray-200" style={{ color }}>{displayLabel}</span>
              </div>
              <div className="flex justify-between border-b border-canopy-700 pb-2 col-span-2 sm:col-span-1">
                <span className="text-gray-500">Confidence</span>
                <span className="text-gray-200">{(event.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between border-b border-canopy-700 pb-2 col-span-2 sm:col-span-1">
                <span className="text-gray-500">Evidence Strength</span>
                <span className={`capitalize font-semibold ${
                  event.evidenceStrength === 'strong' ? 'text-green-400' :
                  event.evidenceStrength === 'moderate' ? 'text-amber-400' : 'text-gray-400'
                }`}>
                  {event.evidenceStrength}{event.evidenceStrength === 'weak' ? ' (ambiguous)' : ''}
                </span>
              </div>
              <div className="flex justify-between border-b border-canopy-700 pb-2 col-span-2 sm:col-span-1">
                <span className="text-gray-500">Alert Policy</span>
                <span className="text-gray-200">{event.alertEligible ? 'Actionable alert' : 'Informational only'}</span>
              </div>
              <div className="flex justify-between border-b border-canopy-700 pb-2 col-span-2 sm:col-span-1">
                <span className="text-gray-500">Operator Verdict</span>
                <span className="text-gray-200 capitalize">
                  {event.verification.status === 'verified' ? 'True Positive' :
                   event.verification.status === 'false_alarm' ? 'False Alarm' :
                   'Not yet verified'}
                </span>
              </div>
              <div className="flex justify-between border-b border-canopy-700 pb-2 col-span-2 sm:col-span-1">
                <span className="text-gray-500">Feedback Status</span>
                <span className="text-gray-200">
                  {event.verification.status === 'verified' || event.verification.status === 'false_alarm'
                    ? 'Captured for future model improvement'
                    : 'Awaiting operator verification'}
                </span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-gray-500">Deployed Model</span>
                <span className="text-gray-200 text-xs text-right max-w-[60%]">{PROTOTYPE_MODEL_DESCRIPTOR}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              Verified false positives/true positives are stored as labeled feedback (see Analytics). In a
              production deployment, accumulated feedback would be incorporated during periodic model
              retraining/calibration cycles: this prototype does not retrain any model live.
            </p>
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
              onClick={() => {
                updateVerification(event.id, event.verification.status, notes, 'Operator');
                setSavedMsg(true);
                setTimeout(() => setSavedMsg(false), 2000);
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
              <Cpu size={18} className="text-forest-500" /> Source
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
                  <span className="text-gray-200">{node.battery.toFixed(0)}%</span>
                </div>
                 <div className="flex justify-between items-center border-b border-canopy-700 pb-2">
                  <span className="text-gray-400 text-sm">Signal</span>
                  <span className="text-gray-200">{node.signalStrength}%</span>
                </div>
                <span className="badge-purple text-[10px] self-start">Simulated Node</span>
                 <div className="mt-2 text-center">
                  <button className="text-forest-500 text-sm hover:underline" onClick={() => navigate(`/sensors/${node.id}`)}>
                    View Node Details
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm flex items-center gap-2">
                <Radio size={16} className="text-gray-600" />
                {event.source.type === 'upload'
                  ? 'Uploaded via browser: no physical sensor node involved.'
                  : event.source.type === 'live-mic'
                  ? 'Captured via this browser\'s microphone: no physical sensor node involved.'
                  : 'No sensor information available.'}
              </div>
            )}
          </div>

          <div className="glass-card p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-forest-500" /> Location / Localization
            </h3>
            {event.location ? (
              <>
                <div className="bg-canopy-900 rounded p-4 border border-canopy-700 text-center mb-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Zone</div>
                  <div className="text-lg font-bold text-gray-200">{event.location.zone}</div>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Lat: {event.location.lat.toFixed(5)}</span>
                  <span>Lng: {event.location.lng.toFixed(5)}</span>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm bg-canopy-900/50 border border-dashed border-canopy-700 rounded-lg p-4 text-center">
                No location: this event has no associated sensor coordinate (browser upload/live-mic session).
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-canopy-700/50">
              {event.localization.status === 'unavailable' ? (
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-400">Localization unavailable</span>: requires multiple
                  synchronized sensor detections of the same event (production capability, not simulated here).
                </p>
              ) : (
                <div className="text-xs space-y-1">
                  <p className="badge-purple inline-block mb-2 text-[10px]">Simulated localization (Demo Mode)</p>
                  <p className="text-gray-300">{event.localization.description}</p>
                  <p className="text-gray-500">+/- {event.localization.uncertaintyMeters}m uncertainty | {(event.localization.confidence * 100).toFixed(0)}% localization confidence</p>
                  <p className="text-gray-500">Corroborated by: {event.localization.contributingSensorIds.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
             <h3 className="text-lg font-bold text-gray-200 mb-4">Event Timeline</h3>
             <div className="flex flex-col gap-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-canopy-600 before:to-transparent">
                {event.verification.history.map((entry, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                     <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-canopy-800 text-slate-500 group-[.is-active]:text-emerald-50 group-[.is-active]:bg-forest-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                     <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-canopy-800 p-3 rounded-lg border border-canopy-700">
                        <div className="text-xs font-semibold text-gray-300">{entry.action}</div>
                        <div className="text-[10px] text-gray-500 mb-1">{formatTimestamp(new Date(entry.timestamp))}</div>
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
