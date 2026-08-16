import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { LiveListen } from './pages/LiveListen';
import { AudioUpload } from './pages/AudioUpload';
import SensorNetwork from './pages/SensorNetwork';
import SensorDetails from './pages/SensorDetails';
import ForestMap from './pages/ForestMap';
import Alerts from './pages/Alerts';
import IncidentDetails from './pages/IncidentDetails';
import Analytics from './pages/Analytics';
import DemoMode from './pages/DemoMode';
import { useSensorStore } from './stores/sensorStore';

const App: React.FC = () => {
  const initialize = useSensorStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
};

export default App;
