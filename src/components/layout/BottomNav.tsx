import React, { useRef, useState } from 'react';
import { Home, Compass, Search, Library } from 'lucide-react';
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
    {
      id: 'explore',
      label: 'Explore',
      icon: Compass,
      isActive: activeTab === 'explore',
      targetView: { type: 'explore' } as AppView,
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
          // ignore
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
      className="fixed bottom-4 inset-x-0 z-40 select-none flex justify-center pointer-events-none md:hidden px-3"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <motion.div 
        ref={containerRef}
        animate={{ scale: isHolding ? 0.97 : 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="pointer-events-auto bg-[#0e0e11]/95 backdrop-blur-3xl border border-white/12 rounded-full p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.9)] flex items-center justify-between gap-1 w-full max-w-sm relative touch-none cursor-pointer"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.targetView)}
              className="relative flex-1 flex flex-row items-center justify-center gap-1.5 py-2 px-2.5 rounded-full transition-all duration-200 cursor-pointer select-none border-0 bg-transparent focus:outline-none"
            >
              {tab.isActive && (
                <motion.div
                  layoutId="bottomNavActiveIndicator"
                  transition={{ type: 'spring', damping: 25, stiffness: 380 }}
                  className="absolute inset-0 bg-white/15 border border-white/20 rounded-full shadow-[0_2px_10px_rgba(255,255,255,0.12)]"
                />
              )}
              <Icon 
                className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-colors duration-200 relative z-10 ${
                  tab.isActive ? 'text-white stroke-[2.3px] drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-neutral-400 stroke-[1.8px] hover:text-neutral-200'
                }`} 
              />
              <span 
                className={`text-[11px] sm:text-[12px] font-bold tracking-tight transition-colors duration-200 relative z-10 truncate ${
                  tab.isActive ? 'text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </motion.div>
    </nav>
  );
};
