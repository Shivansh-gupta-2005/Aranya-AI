import { SensorNode, SensorStatus, SoundEventClass } from '../types';

// ============================================================
// SIMULATED sensor network — clearly labeled as such everywhere it
// surfaces in the UI. Models node telemetry (battery/signal/temp
// drift) for 5 fictional forest nodes. Does NOT create AranyaEvents
// itself — callers (DemoMode, sensorStore) build real events via
// services/eventPipeline.ts using the node info this returns, so
// simulated-sensor events flow through the exact same event pipeline
// as real upload/live-mic detections.
// ============================================================

interface RecentTrigger {
  sensorId: string;
  eventClass: SoundEventClass;
  confidence: number;
  timestamp: Date;
}

export class SensorSimulatorService {
  private nodes: SensorNode[] = [];
  // Short-lived buffer of recent simulated triggers, used only for the
  // multi-node weighted-fusion math below — NOT persisted event history
  // (that lives in useEventStore).
  private recentTriggers: RecentTrigger[] = [];

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
        isSimulated: true
      }
    ];
  }

  getNodes(): SensorNode[] {
    return [...this.nodes];
  }

  getNode(nodeId: string): SensorNode | undefined {
    return this.nodes.find((n) => n.id === nodeId);
  }

  updateNodeStatus(): SensorNode[] {
    this.nodes = this.nodes.map(node => {
      // Simulate slight variations
      const batteryDrain = Math.random() * 0.1; // slow drain
      const tempVariation = (Math.random() - 0.5) * 1.5;
      const newTemp = Math.max(22, Math.min(38, node.temperature + tempVariation));

      const newBattery = Math.max(0, node.battery - batteryDrain);
      const newStatus: SensorStatus = newBattery < 10 || node.signalStrength < 20
        ? 'critical'
        : newBattery < 30 || node.signalStrength < 40
          ? 'warning'
          : 'online';

      return {
        ...node,
        battery: newBattery,
        temperature: newTemp,
        status: newStatus,
        lastHeartbeat: new Date()
      };
    });
    return this.getNodes();
  }

  /**
   * Records a simulated detection trigger against a node's telemetry
   * (for the multi-node fusion buffer) and returns the node so the
   * caller can build a real AranyaEvent via eventPipeline with correct
   * source/location — this method does not create events itself.
   */
  triggerDetection(nodeId: string, eventClass: SoundEventClass, confidence: number): SensorNode | null {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    this.recentTriggers.push({ sensorId: nodeId, eventClass, confidence, timestamp: new Date() });
    // Keep the buffer bounded.
    if (this.recentTriggers.length > 200) this.recentTriggers.shift();

    node.lastHeartbeat = new Date();
    return node;
  }

  /**
   * Weighted multi-node confirmation, per the PDF's fusion formula
   * (C = Σ wᵢCᵢ). Reads the recent-trigger buffer, not persisted event
   * history. Only meaningful when Demo Mode's "Full Forest Incident"
   * scenario has triggered the SAME class across multiple simulated
   * nodes within the window — otherwise returns a low/zero value.
   */
  getMultiNodeConfirmation(eventClass: SoundEventClass): number {
    const thirtySecsAgo = new Date(Date.now() - 30000);
    const weights = [0.5, 0.3, 0.2]; // primary node, 2nd nearest, 3rd nearest

    const relevant = this.recentTriggers
      .filter((t) => t.eventClass === eventClass && t.timestamp >= thirtySecsAgo)
      .sort((a, b) => b.confidence - a.confidence);

    let combined = 0;
    for (let i = 0; i < Math.min(relevant.length, weights.length); i++) {
      combined += relevant[i].confidence * weights[i];
    }
    return Math.min(1.0, combined);
  }

  getContributingNodeIds(eventClass: SoundEventClass): string[] {
    const thirtySecsAgo = new Date(Date.now() - 30000);
    return Array.from(
      new Set(
        this.recentTriggers
          .filter((t) => t.eventClass === eventClass && t.timestamp >= thirtySecsAgo)
          .map((t) => t.sensorId)
      )
    );
  }

  forceSyncNode(nodeId: string): void {
    const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = this.nodes[nodeIndex];
    const batteryDrain = Math.random() * 0.2;
    const tempVariation = (Math.random() - 0.5) * 2;
    const newTemp = Math.max(22, Math.min(38, node.temperature + tempVariation));
    const newBattery = Math.max(0, node.battery - batteryDrain);
    const newStatus: SensorStatus = newBattery < 10 || node.signalStrength < 20
      ? 'critical'
      : newBattery < 30 || node.signalStrength < 40
        ? 'warning'
        : 'online';

    this.nodes[nodeIndex] = {
      ...node,
      battery: newBattery,
      temperature: newTemp,
      signalStrength: Math.max(20, Math.min(100, node.signalStrength + (Math.random() - 0.5) * 10)),
      status: newStatus,
      lastHeartbeat: new Date()
    };
  }

  /** Re-initializes node telemetry to fresh starting values and clears the fusion trigger buffer — used by Reset Demo. */
  resetTelemetry(): void {
    this.initializeNodes();
    this.recentTriggers = [];
  }
}

export const sensorSimulator = new SensorSimulatorService();
