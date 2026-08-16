import React from 'react';
import { Axe, Car, Bird, CloudRain, Crosshair, TreeDeciduous, Flame } from 'lucide-react';
import { SoundEventClass, SOUND_CLASS_COLORS } from '../../types';

interface EventClassIconProps {
  eventClass: SoundEventClass;
  size?: number;
}

export const EventClassIcon: React.FC<EventClassIconProps> = ({ eventClass, size = 20 }) => {
  const color = SOUND_CLASS_COLORS[eventClass];

  const getIcon = () => {
    switch (eventClass) {
      case 'chainsaw': return <Axe size={size} color={color} />;
      case 'vehicle': return <Car size={size} color={color} />;
      case 'wildlife': return <Bird size={size} color={color} />;
      case 'background': return <CloudRain size={size} color={color} />;
      case 'gunshot': return <Crosshair size={size} color={color} />;
      case 'tree_fall': return <TreeDeciduous size={size} color={color} />;
      case 'fire_anomaly': return <Flame size={size} color={color} />;
      default: return <CloudRain size={size} color={color} />;
    }
  };

  return (
    <div 
      className="p-2 rounded-lg bg-opacity-10 border"
      style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}
    >
      {getIcon()}
    </div>
  );
};
