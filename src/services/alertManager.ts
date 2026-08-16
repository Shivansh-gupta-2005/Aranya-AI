import { Alert, AlertStatus, DetectionEvent, SensorNode, TemporalAggregation, TimelineEntry, generateId, getSeverityFromClass, ALERT_DESCRIPTIONS, SoundEventClass } from '../types';

export const getAlertDescription = (eventClass: SoundEventClass): string => {
  return ALERT_DESCRIPTIONS[eventClass] || 'Unknown anomaly detected';
};

export const createAlert = (
  detection: DetectionEvent, 
  sensor: SensorNode,
  temporalAgg?: TemporalAggregation
): Alert => {
  const description = getAlertDescription(detection.eventClass);
  const severity = getSeverityFromClass(detection.eventClass, detection.confidence);
  
  const initialTimelineEntry: TimelineEntry = {
    timestamp: new Date(),
    action: 'Alert Generated',
    detail: `System generated alert from sensor ${sensor.name} (${sensor.id}) with initial confidence ${(detection.confidence * 100).toFixed(1)}%.`,
    actor: 'System'
  };

  return {
    id: generateId(),
    eventClass: detection.eventClass,
    confidence: detection.confidence,
    severity,
    sensorId: sensor.id,
    sensorName: sensor.name,
    location: sensor.location,
    timestamp: new Date(),
    status: 'active',
    isSimulated: true, // Prototype requirement
    description,
    temporalAggregation: temporalAgg,
    contributingSensors: [sensor.id],
    timeline: [initialTimelineEntry]
  };
};

export const updateAlertStatus = (
  alert: Alert, 
  newStatus: AlertStatus, 
  actor: string = 'System'
): Alert => {
  const newTimelineEntry: TimelineEntry = {
    timestamp: new Date(),
    action: 'Status Updated',
    detail: `Alert status changed from ${alert.status} to ${newStatus}`,
    actor
  };

  return {
    ...alert,
    status: newStatus,
    timeline: [...alert.timeline, newTimelineEntry]
  };
};
