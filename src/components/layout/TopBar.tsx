import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Sliders, Home, Search, Library } from 'lucide-react';
import { AppView } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { AuthButton } from '../common/AuthButton';

interface TopBarProps {
  currentView: AppView;
  onNavigateBack: () => void;
  onOpenSettings: () => void;
  onOpenAccountModal?: () => void;
  onNavigate?: (view: AppView) => void;
  title?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onNavigateBack,
  onOpenSettings,
  onOpenAccountModal,
  onNavigate,
  title,
}) => {
  const isDrilldown =
    currentView.type === 'album' ||
    currentView.type === 'artist' ||
    currentView.type === 'playlist' ||
    currentView.type === 'seeAll';

  const isHomeActive = currentView.type === 'home' || currentView.type === 'seeAll';
  const isSearchActive = currentView.type === 'search';
  const isLibraryActive = currentView.type === 'library';

  const handleSettingsClick = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // ignore
      }
    }
    onOpenSettings();
  };

  return (
    <header className="sticky top-0 z-30 pt-safe glass-surface border-b border-white/[0.06] select-none transition-all">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between relative">
        {/* Left: Back button or Logo */}
        <div className="flex items-center gap-3 shrink-0 z-10">
          {isDrilldown ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onNavigateBack}
              aria-label="Go back"
              className="flex items-center gap-1 -ml-2 py-1.5 px-2.5 rounded-full text-white hover:text-neutral-300 hover:bg-white/5 transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              <span className="text-sm font-medium">Back</span>
            </motion.button>
          ) : (
            <div className="flex items-center gap-2.5 pointer-events-none select-none">
              <h1 className="text-xl font-extrabold tracking-wide text-white leading-none">
                Celestial Music
              </h1>
              <div className="w-8 h-8 flex items-center justify-center relative">
                <span className="relative text-2xl drop-shadow-[0_0_12px_rgba(59,130,246,0.9)] select-none">🧿</span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Perfectly Centered Navigation Links (Desktop/Tablet) or Drilldown Title */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20">
          {isDrilldown && title ? (
            <div className="truncate max-w-[240px] sm:max-w-md text-center pointer-events-auto">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider truncate block">
                {title}
              </span>
            </div>
          ) : onNavigate ? (
            <nav className="hidden md:flex items-center gap-1 p-1 bg-[#1a1a1f] border border-white/[0.08] rounded-full shadow-inner pointer-events-auto">
              <button
                onClick={() => onNavigate({ type: 'home' })}
                className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isHomeActive ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {isHomeActive && (
                  <motion.div
                    layoutId="topNavActiveIndicator"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="absolute inset-0 bg-white/15 border border-white/20 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                  />
                )}
                <Home className={`relative z-10 w-3.5 h-3.5 ${isHomeActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.7)]' : ''}`} />
                <span className="relative z-10">Home</span>
              </button>

              <button
                onClick={() => {
                  if (onNavigate) {
                    if (isSearchActive) {
                      onNavigate({ type: 'search', autoFocus: true });
                      const input = document.getElementById('search-input-field') as HTMLInputElement | null;
                      if (input) {
                        input.focus();
                        if (input.value) {
                          input.setSelectionRange(input.value.length, input.value.length);
                        }
                      }
                      window.dispatchEvent(new CustomEvent('celestial:focus-search'));
                    } else {
                      onNavigate({ type: 'search' });
                    }
                  }
                }}
                className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isSearchActive ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {isSearchActive && (
                  <motion.div
                    layoutId="topNavActiveIndicator"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="absolute inset-0 bg-white/15 border border-white/20 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                  />
                )}
                <Search className={`relative z-10 w-3.5 h-3.5 ${isSearchActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.7)]' : ''}`} />
                <span className="relative z-10">Search</span>
              </button>

              <button
                onClick={() => onNavigate({ type: 'library' })}
                className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isLibraryActive ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {isLibraryActive && (
                  <motion.div
                    layoutId="topNavActiveIndicator"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="absolute inset-0 bg-white/15 border border-white/20 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                  />
                )}
                <Library className={`relative z-10 w-3.5 h-3.5 ${isLibraryActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.7)]' : ''}`} />
                <span className="relative z-10">Library</span>
              </button>
            </nav>
          ) : null}
        </div>

        {/* Right: Auth Button + Install button + Animated Settings Button */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 z-10">
          <AuthButton onOpenAccountModal={onOpenAccountModal} />
          <PWAInstallButton variant="pill" />

          <motion.button
            whileHover={{ scale: 1.08, backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
            whileTap={{ scale: 0.85, rotate: 90 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            onClick={handleSettingsClick}
            aria-label="Open Settings"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 hover:text-white border border-white/10 shadow-sm cursor-pointer"
          >
            <motion.div
              initial={{ rotate: 0 }}
              whileHover={{ rotate: 30 }}
              transition={{ duration: 0.2 }}
            >
              <Sliders className="w-4 h-4" />
            </motion.div>
          </motion.button>
        </div>
      </div>
    </header>
  );
};
