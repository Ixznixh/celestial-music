import React, { useRef, useState } from 'react';
import { Home, Search, Library } from 'lucide-react';
import { motion } from 'motion/react';
import { AppView } from '../../types';

interface BottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHolding, setIsHolding] = useState(false);
  const activeTab = currentView.type;

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      isActive: activeTab === 'home' || activeTab === 'seeAll',
      targetView: { type: 'home' } as AppView,
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      isActive: activeTab === 'search',
      targetView: { type: 'search' } as AppView,
    },
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      isActive: activeTab === 'library' || activeTab === 'playlist',
      targetView: { type: 'library' } as AppView,
    },
  ];

  const updateTabFromPointer = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const tabWidth = rect.width / tabs.length;
    let index = Math.floor(relativeX / tabWidth);
    index = Math.max(0, Math.min(tabs.length - 1, index));

    const targetTab = tabs[index];
    if (targetTab && !targetTab.isActive) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // ignore if vibration not allowed
        }
      }
      onNavigate(targetTab.targetView);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsHolding(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updateTabFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHolding) return;
    updateTabFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isHolding) {
      updateTabFromPointer(e.clientX);
      setIsHolding(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handlePointerCancel = () => {
    setIsHolding(false);
  };

  return (
    <nav 
      aria-label="Main Navigation"
      className="fixed bottom-3 inset-x-0 z-40 select-none flex justify-center pointer-events-none md:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <motion.div 
        ref={containerRef}
        animate={{ scale: isHolding ? 0.97 : 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="pointer-events-auto bg-[#000000]/95 backdrop-blur-3xl border border-white/10 rounded-full p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] flex items-center justify-between gap-1 w-[94%] max-w-lg relative touch-none cursor-pointer"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.targetView)}
              className="relative flex-1 flex items-center justify-center py-3 px-3 rounded-full transition-colors duration-200 cursor-pointer select-none border-0 bg-transparent focus:outline-none"
            >
              {tab.isActive && (
                <motion.div
                  layoutId="bottomNavActiveIndicator"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="absolute inset-0 bg-white/[0.12] border border-white/20 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                />
              )}
              <div className="relative z-10 flex items-center gap-2 pointer-events-none">
                <Icon 
                  className={`w-4.5 h-4.5 transition-colors duration-200 ${
                    tab.isActive ? 'text-white stroke-[2.2px] drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-neutral-400 stroke-[1.8px]'
                  }`} 
                />
                <span 
                  className={`text-[13px] font-bold tracking-wide transition-colors duration-200 ${
                    tab.isActive ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]' : 'text-neutral-400'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </motion.div>
    </nav>
  );
};
