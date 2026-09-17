import React, { useState } from 'react';
import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  activeColor?: string; // default to '#ffffff' for white accent theme
}

export const GlassSwitch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  ariaLabel = 'Toggle switch',
  disabled = false,
  size = 'sm',
  activeColor = '#ffffff',
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(10); } catch {}
    }
    onChange(!checked);
  };

  // Compact dimensions:
  // sm: track 38px x 22px, thumb 18px, travel 16px (38 - 4 - 18 = 16)
  // md: track 44px x 26px, thumb 22px, travel 18px (44 - 4 - 22 = 18)
  const isSm = size === 'sm';
  const trackWidth = isSm ? 38 : 44;
  const trackHeight = isSm ? 22 : 26;
  const thumbSize = isSm ? 18 : 22;
  const normalTravel = isSm ? 16 : 18;
  const pressedTravel = isSm ? 13 : 14;
  const pressedWidth = isSm ? 21 : 26;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleToggle}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => !disabled && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      style={{
        width: `${trackWidth}px`,
        height: `${trackHeight}px`,
        backgroundColor: checked ? activeColor : '#39393d',
      }}
      className={`relative inline-flex items-center shrink-0 rounded-full p-[2px] transition-colors duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      }`}
    >
      <motion.span
        initial={false}
        animate={{
          x: checked ? (isPressed ? pressedTravel : normalTravel) : 0,
          width: isPressed ? pressedWidth : thumbSize,
        }}
        transition={{
          type: 'spring',
          stiffness: 700,
          damping: 35,
          mass: 0.8,
        }}
        style={{
          height: `${thumbSize}px`,
        }}
        className="block rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.3)] pointer-events-none"
      />
    </button>
  );
};

export const ToggleSwitch = GlassSwitch;
export const IOSSwitch = GlassSwitch;
