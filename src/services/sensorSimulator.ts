import { DetectionEvent, SensorNode, SoundEventClass, generateId } from '../types';

export class SensorSimulatorService {
  private nodes: SensorNode[] = [];

  constructor() {
    this.initializeNodes();
  }

  private initializeNodes() {
    this.nodes = [
      {
        id: 'ARANYA-N01',
        name: 'Western Ridge',
        location: { lat: 21.1497, lng: 79.0806, zone: 'Zone A - Dense Forest', description: 'Dense cover' },
        battery: 98,
        signalStrength: 95,
        temperature: 28,
        humidity: 60,
        status: 'online',
        lastHeartbeat: new Date(),
        uptime: 120,
        detectionHistory: [],
        isSimulated: true
      },
      {
        id: 'ARANYA-N02',
        name: 'River Valley',
        location: { lat: 21.1520, lng: 79.0850, zone: 'Zone B - Riparian', description: 'Near water body' },
        battery: 82,
        signalStrength: 75,
        temperature: 26,
        humidity: 85,
        status: 'online',
        lastHeartbeat: new Date(),
        uptime: 450,
        detectionHistory: [],
        isSimulated: true
      },
      {
        id: 'ARANYA-N03',
        name: 'Eastern Canopy',
        location: { lat: 21.1480, lng: 79.0880, zone: 'Zone C - Mixed Forest', description: 'Canopy coverage high' },
        battery: 65,
        signalStrength: 55,
        temperature: 30,
        humidity: 50,
        status: 'warning',
        lastHeartbeat: new Date(),
        uptime: 900,
        detectionHistory: [],
        isSimulated: true
      },
      {
        id: 'ARANYA-N04',
        name: 'Northern Grassland',
        location: { lat: 21.1540, lng: 79.0830, zone: 'Zone D - Grassland Edge', description: 'Open area' },
        battery: 95,
        signalStrength: 90,
        temperature: 32,
        humidity: 45,
        status: 'online',
        lastHeartbeat: new Date(),
        uptime: 20,
        detectionHistory: [],
        isSimulated: true
      },
      {
        id: 'ARANYA-N05',
        name: 'Southern Teak',
        location: { lat: 21.1460, lng: 79.0790, zone: 'Zone E - Teak Plantation', description: 'Teak dominated' },
        battery: 88,
        signalStrength: 85,
        temperature: 29,
        humidity: 55,
        status: 'online',
        lastHeartbeat: new Date(),
        uptime: 300,
        detectionHistory: [],
        isSimulated: true
      }
    ];
  }

  getNodes(): SensorNode[] {
    return [...this.nodes];
  }

  updateNodeStatus(): SensorNode[] {
    this.nodes = this.nodes.map(node => {
      // Simulate slight variations
      const batteryDrain = Math.random() * 0.1; // slow drain
      const tempVariation = (Math.random() - 0.5) * 1.5;
      const newTemp = Math.max(22, Math.min(38, node.temperature + tempVariation));
      
      const newBattery = Math.max(0, node.battery - batteryDrain);
      let newStatus = node.status;
      if (newBattery < 10 || node.signalStrength < 20) newStatus = 'critical';
      else if (newBattery < 30 || node.signalStrength < 40) newStatus = 'warning';
      else newStatus = 'online';

      return {
        ...node,
        battery: newBattery,
        temperature: newTemp,
        status: newStatus as any,
        lastHeartbeat: new Date()
      };
    });
    return this.getNodes();
  }

  triggerDetection(nodeId: string, eventClass: SoundEventClass, confidence: number): DetectionEvent | null {
    const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return null;

    const node = this.nodes[nodeIndex];
    let severity: any = 'low';
    if (confidence >= 0.9) severity = 'critical';
    else if (confidence >= 0.75) severity = 'high';
    else if (confidence >= 0.5) severity = 'medium';
    
    if (eventClass === 'wildlife' || eventClass === 'background') severity = 'low';

    const detection: DetectionEvent = {
      id: generateId(),
      sensorId: node.id,
      eventClass,
      confidence,
      severity,
      timestamp: new Date(),
      duration: 5, // 5 second sample
      isSimulated: true,
      location: node.location
    };

    const updatedNode = { ...node, detectionHistory: [detection, ...node.detectionHistory].slice(0, 50) };
    this.nodes[nodeIndex] = updatedNode;
    return detection;
  }

  getMultiNodeConfirmation(eventClass: SoundEventClass): number {
    // Collect all detections for this event class across nodes within last 30 seconds
    const thirtySecsAgo = new Date(Date.now() - 30000);
    
    let combinedConfidence = 0;
    const weights = [0.5, 0.3, 0.2]; // Weighted fusion: main node, 2nd nearest, 3rd nearest
    
    const relevantDetections = this.nodes
      .flatMap(n => n.detectionHistory)
      .filter(d => d.eventClass === eventClass && d.timestamp >= thirtySecsAgo)
      .sort((a, b) => b.confidence - a.confidence);

    for (let i = 0; i < Math.min(relevantDetections.length, weights.length); i++) {
      combinedConfidence += relevantDetections[i].confidence * weights[i];
    }
    
    return Math.min(1.0, combinedConfidence);
  }

  forceSyncNode(nodeId: string): void {
    const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = this.nodes[nodeIndex];
    const batteryDrain = Math.random() * 0.2;
    const tempVariation = (Math.random() - 0.5) * 2;
    const newTemp = Math.max(22, Math.min(38, node.temperature + tempVariation));
    const newBattery = Math.max(0, node.battery - batteryDrain);
    let newStatus = node.status;
    if (newBattery < 10 || node.signalStrength < 20) newStatus = 'critical';
    else if (newBattery < 30 || node.signalStrength < 40) newStatus = 'warning';
    else newStatus = 'online';

    this.nodes[nodeIndex] = {
      ...node,
      battery: newBattery,
      temperature: newTemp,
      signalStrength: Math.max(20, Math.min(100, node.signalStrength + (Math.random() - 0.5) * 10)),
      status: newStatus as any,
      lastHeartbeat: new Date()
    };
  }
}

export const sensorSimulator = new SensorSimulatorService();
