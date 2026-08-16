import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { SOUND_CLASS_COLORS } from '../types';

// Mock Analytics Data Generator
const generateMockData = () => {
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  const eventsOverTime = days.map(day => ({
    name: day,
    chainsaw: Math.floor(Math.random() * 5),
    vehicle: Math.floor(Math.random() * 10),
    wildlife: Math.floor(Math.random() * 20) + 10,
    gunshot: Math.floor(Math.random() * 2),
    fire_anomaly: Math.floor(Math.random() * 1)
  }));

  const eventsByType = [
    { name: 'Chainsaw', value: 15, color: SOUND_CLASS_COLORS.chainsaw },
    { name: 'Vehicle', value: 34, color: SOUND_CLASS_COLORS.vehicle },
    { name: 'Wildlife', value: 142, color: SOUND_CLASS_COLORS.wildlife },
    { name: 'Gunshot', value: 4, color: SOUND_CLASS_COLORS.gunshot },
    { name: 'Fire', value: 2, color: SOUND_CLASS_COLORS.fire_anomaly },
  ];

  const eventsByZone = [
    { name: 'North Ridge', events: 45 },
    { name: 'East Valley', events: 23 },
    { name: 'South Border', events: 67 },
    { name: 'West Sector', events: 12 },
    { name: 'Central Core', events: 50 },
  ];

  const confidenceDist = [
    { name: '<50%', value: 12 },
    { name: '50-65%', value: 25 },
    { name: '65-80%', value: 45 },
    { name: '80-90%', value: 80 },
    { name: '90%+', value: 35 },
  ];

  const falseAlertRate = days.map(day => ({
    name: day,
    rate: (Math.random() * 15 + 5).toFixed(1)
  }));

  return { eventsOverTime, eventsByType, eventsByZone, confidenceDist, falseAlertRate };
};

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
  const data = useMemo(() => generateMockData(), []);

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 overflow-y-auto">
      <div className="flex justify-between items-center glass-card p-4 rounded-xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="text-forest-500" /> System Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">Acoustic detection performance and network metrics</p>
        </div>
        <div className="badge-purple px-4 py-2 text-sm font-bold flex items-center gap-2">
           <AlertTriangle size={16} /> Prototype / Simulated Data
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Events Over Time */}
        <div className="glass-card p-6 rounded-xl col-span-1 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Detection Events (Last 7 Days)</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.eventsOverTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWild" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SOUND_CLASS_COLORS.wildlife} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={SOUND_CLASS_COLORS.wildlife} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorChain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SOUND_CLASS_COLORS.chainsaw} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={SOUND_CLASS_COLORS.chainsaw} stopOpacity={0}/>
                  </linearGradient>
                   <linearGradient id="colorVeh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SOUND_CLASS_COLORS.vehicle} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={SOUND_CLASS_COLORS.vehicle} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                <Area type="monotone" dataKey="wildlife" name="Wildlife" stroke={SOUND_CLASS_COLORS.wildlife} fillOpacity={1} fill="url(#colorWild)" />
                <Area type="monotone" dataKey="vehicle" name="Vehicle" stroke={SOUND_CLASS_COLORS.vehicle} fillOpacity={1} fill="url(#colorVeh)" />
                <Area type="monotone" dataKey="chainsaw" name="Chainsaw" stroke={SOUND_CLASS_COLORS.chainsaw} fillOpacity={1} fill="url(#colorChain)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Events by Type Pie */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Distribution by Event Class</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.eventsByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.eventsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Events by Zone Bar */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">Hotspots by Zone</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.eventsByZone} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#1a2420'}} />
                <Bar dataKey="events" name="Total Events" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confidence Dist Bar */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6">AI Confidence Distribution</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.confidenceDist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#1a2420'}} />
                <Bar dataKey="value" name="Detections" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* False Alert Rate Line */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-lg font-bold text-gray-200 mb-6 flex justify-between items-center">
            False Alert Rate (%)
            <span className="text-sm font-normal text-green-400 flex items-center gap-1"><TrendingDown size={14}/> Improved</span>
          </h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.falseAlertRate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d4038" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rate" name="False +ve Rate" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444', strokeWidth: 0}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
