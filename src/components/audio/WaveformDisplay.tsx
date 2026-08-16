import React, { useRef, useEffect, useState } from 'react';

export interface WaveformDisplayProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  isLive?: boolean;
  className?: string;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  data,
  width,
  height = 100,
  color = '#22c55e',
  isLive = false,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      // Horizontal center line
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      
      // Vertical lines
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
      }
      ctx.stroke();

      if (!data || data.length === 0) {
        if (isLive) {
            animationFrameId = requestAnimationFrame(draw);
        }
        return;
      }

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      
      if (isLive) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 0;
      }

      const sliceWidth = canvas.width * 1.0 / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        // Assume data is normalized between -1 and 1
        const v = data[i];
        const y = (v * canvas.height / 2) + (canvas.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      if (isLive) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [data, dimensions, color, isLive]);

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
