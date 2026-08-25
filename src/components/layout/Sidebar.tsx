import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  TreePine,
  LayoutDashboard,
  Mic,
  Upload,
  Radio,
  Map as MapIcon,
  Bell,
  BarChart3,
  Play,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useEventStore } from '../../stores/eventStore';
import { resetDemoSession } from '../../services/sessionReset';

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const getActiveEvents = useEventStore((state) => state.getActiveEvents);
  const activeAlertsCount = getActiveEvents().length;

  const handleResetDemo = () => {
    const confirmed = window.confirm(
      'Start a fresh demo session? This will clear current session data (detected events, alerts, incidents, feedback, and simulated sensor telemetry). Model files and app configuration are not affected.'
    );
    if (!confirmed) return;
    resetDemoSession();
    navigate('/');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { id: 'live', label: 'Live Listen', path: '/live-listen', icon: Mic },
    { id: 'upload', label: 'Audio Upload', path: '/audio-upload', icon: Upload },
    { id: 'sensors', label: 'Sensor Network', path: '/sensors', icon: Radio },
    { id: 'map', label: 'Forest Map', path: '/map', icon: MapIcon },
    { id: 'alerts', label: 'Alerts', path: '/alerts', icon: Bell, badge: activeAlertsCount },
    { id: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { id: 'demo', label: 'Demo Mode', path: '/demo', icon: Play },
  ];

  return (
    <aside className={`relative flex flex-col bg-canopy-900 border-r border-canopy-800 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-canopy-800 h-16">
        <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}>
          <div className="p-1.5 bg-forest-500/20 text-forest-500 rounded-lg shrink-0">
            <TreePine size={24} />
          </div>
          {!collapsed && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="font-bold text-lg text-white tracking-wide leading-tight">ARANYA AI</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider truncate">Distributed Acoustic Intel</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-5 bg-canopy-800 border border-canopy-700 rounded-full p-1 text-gray-400 hover:text-white hover:bg-canopy-700 z-10"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                isActive 
                  ? 'bg-forest-500/10 text-forest-500 border-l-2 border-forest-500' 
                  : 'text-gray-400 hover:bg-canopy-800 hover:text-white border-l-2 border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between overflow-hidden">
                  <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-2">
        <button
          onClick={handleResetDemo}
          title="Reset Demo"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-amber-400 border border-amber-800/40 hover:bg-amber-950/30 hover:border-amber-600/50 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <RotateCcw size={18} className="shrink-0" />
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Reset Demo</span>}
        </button>
      </div>

      <div className="p-4 border-t border-canopy-800 bg-canopy-900/50">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex items-center justify-center shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-forest-500 opacity-30 animate-ping"></span>
            <span className="relative inline-flex rounded-full w-2 h-2 bg-forest-500"></span>
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <span className="text-xs font-medium text-gray-300">System Online</span>
              <span className="text-[10px] text-purple-400 font-medium">Prototype Build</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
