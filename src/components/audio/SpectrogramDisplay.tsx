import React, { useRef, useEffect, useState } from 'react';

export interface SpectrogramDisplayProps {
  data: number[][]; // Array of frequency bins over time (time x frequency)
  width?: number;
  height?: number;
  className?: string;
}

export const SpectrogramDisplay: React.FC<SpectrogramDisplayProps> = ({
  data,
  width,
  height = 200,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: width || 800, height });

  useEffect(() => {
    if (width) return;
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: height
        });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // Color map function (0 to 1 value to RGB)
  const getColor = (value: number) => {
    // dark blue/black -> green -> yellow -> red
    const r = Math.min(255, Math.max(0, 255 * (value - 0.5) * 2)); // Red starts coming in past 0.5, reaches max at 1.0
    const g = Math.min(255, Math.max(0, 255 * (1 - Math.abs(value - 0.5) * 2))); // Green max at 0.5
    const b = Math.min(255, Math.max(0, 255 * (0.5 - value) * 2)); // Blue max at 0, gone by 0.5
    
    // Adjusted custom palette for better look
    // 0: #0a0f0d (dark)
    // 0.33: #111916 / dark green
    // 0.66: #22c55e (forest green)
    // 0.8: #eab308 (yellow)
    // 1.0: #ef4444 (red)
    
    if (value < 0.2) return `rgb(10, 15, 13)`;
    if (value < 0.5) return `rgb(${20 + value * 50}, ${30 + value * 100}, ${20 + value * 50})`; // Dark to mid green
    if (value < 0.8) return `rgb(${34 + (value-0.5)*300}, ${197 + (value-0.5)*100}, ${94 - (value-0.5)*100})`; // Green to yellow
    return `rgb(${234 + (value-0.8)*100}, ${179 - (value-0.8)*500}, ${8 - (value-0.8)*40})`; // Yellow to red
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0f0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!data || data.length === 0 || data[0].length === 0) return;

    const numTimeSteps = data.length;
    const numFreqBins = data[0].length;
    
    const timeStepWidth = canvas.width / numTimeSteps;
    const freqBinHeight = canvas.height / numFreqBins;

    for (let t = 0; t < numTimeSteps; t++) {
      for (let f = 0; f < numFreqBins; f++) {
        const value = data[t][f];
        // Y-axis: low frequency at bottom, high at top
        const y = canvas.height - (f + 1) * freqBinHeight;
        const x = t * timeStepWidth;
        
        ctx.fillStyle = getColor(value);
        // Slightly overlap to avoid anti-aliasing gaps
        ctx.fillRect(x, y, Math.ceil(timeStepWidth), Math.ceil(freqBinHeight));
      }
    }
  }, [data, dimensions]);

  return (
    <div ref={containerRef} className={`w-full bg-[#0a0f0d] rounded-lg overflow-hidden border border-[#1a2420] ${className}`}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full block"
      />
    </div>
  );
};
