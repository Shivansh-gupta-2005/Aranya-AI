import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { useSensorStore } from './stores/sensorStore';

const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard }))
);
const LiveListen = lazy(() =>
  import('./pages/LiveListen').then((module) => ({ default: module.LiveListen }))
);
const AudioUpload = lazy(() =>
  import('./pages/AudioUpload').then((module) => ({ default: module.AudioUpload }))
);
const SensorNetwork = lazy(() => import('./pages/SensorNetwork'));
const SensorDetails = lazy(() => import('./pages/SensorDetails'));
const ForestMap = lazy(() => import('./pages/ForestMap'));
const Alerts = lazy(() => import('./pages/Alerts'));
const IncidentDetails = lazy(() => import('./pages/IncidentDetails'));
const Analytics = lazy(() => import('./pages/Analytics'));
const DemoMode = lazy(() => import('./pages/DemoMode'));

const App: React.FC = () => {
  const initialize = useSensorStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6 text-gray-400">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="live-listen" element={<LiveListen />} />
            <Route path="audio-upload" element={<AudioUpload />} />
            <Route path="sensors" element={<SensorNetwork />} />
            <Route path="sensors/:id" element={<SensorDetails />} />
            <Route path="map" element={<ForestMap />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="incidents/:id" element={<IncidentDetails />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="demo" element={<DemoMode />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
