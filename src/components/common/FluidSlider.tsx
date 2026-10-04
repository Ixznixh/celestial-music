import React, { useRef, useState, useCallback, useEffect } from 'react';

interface FluidSliderProps {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  glowColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FluidSlider: React.FC<FluidSliderProps> = ({
  value,
  min = 0,
  max,
  step = 1,
  onChange,
  onChangeEnd,
  disabled = false,
  className = '',
  ariaLabel = 'Slider',
  glowColor = 'rgba(255, 255, 255, 0.4)',
  size = 'md',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragValue, setDragValue] = useState(value);
  const isDraggingRef = useRef(false);
  const currentDragValRef = useRef(value);

  // Keep internal drag state synced when not dragging
  useEffect(() => {
    if (!isDragging) {
      setDragValue(value);
      currentDragValRef.current = value;
    }
  }, [value, isDragging]);

  const safeMax = Math.max(min + 0.0001, max);
  const displayVal = isDragging ? dragValue : value;
  const clampedVal = Math.max(min, Math.min(safeMax, displayVal));
  const percent = Math.max(0, Math.min(100, ((clampedVal - min) / (safeMax - min)) * 100));

  const calculateValueFromPointer = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = rect.width > 0 ? clickX / rect.width : 0;
      let rawVal = min + ratio * (safeMax - min);

      if (step > 0) {
        rawVal = Math.round((rawVal - min) / step) * step + min;
      }
      return Math.max(min, Math.min(safeMax, rawVal));
    },
    [min, safeMax, step]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    setIsDragging(true);
    isDraggingRef.current = true;

    const newVal = calculateValueFromPointer(e.clientX);
    setDragValue(newVal);
    currentDragValRef.current = newVal;
    onChange?.(newVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return;
    e.stopPropagation();
    e.preventDefault();

    const newVal = calculateValueFromPointer(e.clientX);
    setDragValue(newVal);
    currentDragValRef.current = newVal;
    onChange?.(newVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return;
    e.stopPropagation();
    e.preventDefault();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const finalVal = currentDragValRef.current;
    setIsDragging(false);
    isDraggingRef.current = false;

    onChangeEnd?.(finalVal);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return;
    e.stopPropagation();
    const finalVal = currentDragValRef.current;
    setIsDragging(false);
    isDraggingRef.current = false;
    onChangeEnd?.(finalVal);
  };

  const trackHeights = {
    sm: 'h-1 group-hover:h-1.5',
    md: 'h-1.5 group-hover:h-2',
    lg: 'h-2 group-hover:h-2.5',
  };

  const thumbSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={displayVal}
      aria-valuemin={min}
      aria-valuemax={safeMax}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => e.stopPropagation()}
      className={`relative group flex items-center w-full py-2.5 cursor-pointer touch-none select-none ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* Background Track Rail */}
      <div
        className={`w-full rounded-full bg-white/20 relative transition-[height] duration-150 ease-out overflow-hidden ${trackHeights[size]}`}
      >
        {/* Filled Progress Bar (Syncs perfectly with 0ms transition on width to avoid jumping) */}
        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full"
          style={{
            width: `${percent}%`,
            boxShadow: isDragging || isHovered ? `0 0 10px ${glowColor}` : 'none',
          }}
        />
      </div>

      {/* Floating Precision Thumb Knob (Syncs perfectly in lockstep with percent) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          left: `${percent}%`,
        }}
      >
        <div
          className={`${thumbSizes[size]} rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.7),0_0_2px_rgba(255,255,255,0.9)] border border-black/10 transition-transform duration-150 ease-out ${
            isDragging
              ? 'scale-125 shadow-[0_0_12px_rgba(255,255,255,0.95)]'
              : isHovered
              ? 'scale-110 shadow-[0_0_8px_rgba(255,255,255,0.7)]'
              : 'scale-95 opacity-90'
          }`}
        />
      </div>
    </div>
  );
};

