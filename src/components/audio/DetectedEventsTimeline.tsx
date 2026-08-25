import React from 'react';
import { SOUND_CLASS_COLORS, SOUND_CLASS_LABELS } from '../../types';
import { AranyaEvent } from '../../types/event';

export interface DetectedEventsTimelineProps {
  events: AranyaEvent[];
  duration: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * A horizontal strip spanning the clip's real duration, with one marker
 * per real detected event positioned at its real start/end time, plus a
 * moving playhead synced to actual <audio> playback. Clicking a marker
 * seeks playback there. Every position on this strip is derived from
 * real event/audio data: nothing here is a fabricated placement.
 */
export const DetectedEventsTimeline: React.FC<DetectedEventsTimelineProps> = ({
  events,
  duration,
  currentTime,
  onSeek,
  className = '',
}) => {
  if (!duration || duration <= 0) return null;

  const pct = (t: number) => Math.min(100, Math.max(0, (t / duration) * 100));

  return (
    <div className={`w-full ${className}`}>
      <div
        className="relative w-full h-10 bg-[#0a0f0d] rounded-lg border border-[#1a2420] cursor-pointer overflow-hidden"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          onSeek(frac * duration);
        }}
      >
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-20 pointer-events-none"
          style={{ left: `${pct(currentTime)}%` }}
        />

        {/* Event markers */}
        {events.map((ev) => {
          const start = ev.startTime ?? 0;
          const end = ev.endTime ?? start;
          const left = pct(start);
          const width = Math.max(0.6, pct(end) - pct(start));
          const color = SOUND_CLASS_COLORS[ev.eventClass];
          return (
            <div
              key={ev.id}
              title={`${SOUND_CLASS_LABELS[ev.eventClass]}: ${(ev.confidence * 100).toFixed(0)}% @ ${start.toFixed(2)}s`}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(start);
              }}
              className="absolute top-1 bottom-1 rounded-sm z-10 hover:opacity-80 transition-opacity"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
        <span>0:00</span>
        <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
      </div>
    </div>
  );
};
