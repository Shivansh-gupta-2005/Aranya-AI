import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { SimulatedBadge } from '../common/SimulatedBadge';
import { useAlertStore } from '../../stores/alertStore';

export const Header: React.FC = () => {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const activeAlertsCount = useAlertStore((state) => state.getActiveAlerts().length);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/live': return 'Live Listen';
      case '/upload': return 'Audio Upload';
      case '/sensors': return 'Sensor Network';
      case '/map': return 'Forest Map';
      case '/alerts': return 'Alerts';
      case '/analytics': return 'Analytics';
      case '/demo': return 'Demo Mode';
      default: return 'ARANYA AI';
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-canopy-900 border-b border-canopy-800 z-10 sticky top-0">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-white tracking-wide">{getPageTitle()}</h1>
        <SimulatedBadge />
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-500" />
          </div>
          <input 
            type="text" 
            placeholder="Search network..." 
            className="w-64 bg-canopy-800 border border-canopy-700 text-gray-200 text-sm rounded-lg focus:ring-forest-500 focus:border-forest-500 block pl-10 p-2 placeholder-gray-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-4 border-l border-canopy-800 pl-6">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-gray-200 font-mono">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              {currentTime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
          
          <button className="relative p-2 text-gray-400 hover:text-white hover:bg-canopy-800 rounded-lg transition-colors">
            <Bell size={20} />
            {activeAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-canopy-900 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
