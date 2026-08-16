import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'green' | 'amber' | 'red' | 'blue' | 'gray';
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'green' 
}) => {
  const colorStyles = {
    green: 'text-forest-500 bg-forest-500/10 border-forest-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    gray: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  };

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
          
          {trend ? (
            <div className="flex items-center text-xs">
              <span className={`flex items-center ${trend.isPositive ? 'text-forest-500' : 'text-red-500'} font-medium`}>
                {trend.isPositive ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                {trend.value}%
              </span>
              <span className="text-gray-500 ml-2">vs last week</span>
            </div>
          ) : subtitle ? (
            <p className="text-gray-500 text-xs">{subtitle}</p>
          ) : null}
        </div>
        
        <div className={`p-3 rounded-xl border ${colorStyles[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};
