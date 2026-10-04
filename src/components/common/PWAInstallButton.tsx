import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Monitor } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'pill' | 'banner' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'pill' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress when already running standalone on home screen
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // General instructions
      setShowIOSGuide(true);
    }
  };

  if (variant === 'settings') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-neutral-850 hover:bg-neutral-800 transition text-left text-sm font-medium text-white"
        >
          <div className="flex items-center gap-3">
            <img 
              src="/pwa-192x192.png" 
              alt="Celestial Music" 
              className="w-8 h-8 rounded-xl object-contain shadow-md border border-white/10"
            />
            <div>
              <p className="font-medium">Install Celestial Music App</p>
              <p className="text-xs text-neutral-400">Add to your device Home Screen</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white font-medium">
            Install
          </span>
        </button>

        {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div className="mx-4 my-2 p-3 rounded-2xl bg-[#0d0e11] border border-white/10 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <img 
              src="/pwa-192x192.png" 
              alt="Celestial Music" 
              className="w-9 h-9 rounded-xl object-contain shadow-md border border-white/10 shrink-0"
            />
            <div>
              <p className="text-xs font-semibold text-white">Experience Celestial Music on iOS & Android</p>
              <p className="text-[11px] text-neutral-400">Fast, offline playback, no address bar</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-neutral-200 active:scale-95 transition text-xs font-bold text-black shrink-0"
          >
            Get App
          </button>
        </div>

        {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />}
      </>
    );
  }

  // Pill variant (header / compact)
  return (
    <>
      <button
        onClick={handleInstallClick}
        aria-label="Install Celestial Music application"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 active:scale-95 border border-white/10 text-xs font-medium text-neutral-200 transition"
      >
        <Download className="w-3.5 h-3.5 text-white" />
        <span>Install</span>
      </button>

      {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />}
    </>
  );
};

const IOSGuideModal: React.FC<{ onClose: () => void; isIOS: boolean }> = ({ onClose, isIOS }) => {
  // Simple heuristic for desktop vs mobile detection
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [activePlatform, setActivePlatform] = useState<'desktop' | 'ios' | 'android'>(
    isIOS ? 'ios' : (!isMobile ? 'desktop' : 'android')
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-[#1c1c1e] border border-white/15 p-5 sm:p-6 shadow-2xl text-white relative my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-base font-semibold">
            Install Celestial Music
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center p-1 bg-black/40 rounded-xl mt-3 border border-white/5">
          <button
            onClick={() => setActivePlatform('desktop')}
            className={`flex-1 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition text-center ${
              activePlatform === 'desktop'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Desktop
          </button>
          <button
            onClick={() => setActivePlatform('ios')}
            className={`flex-1 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition text-center ${
              activePlatform === 'ios'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Apple iOS
          </button>
          <button
            onClick={() => setActivePlatform('android')}
            className={`flex-1 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition text-center ${
              activePlatform === 'android'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Android
          </button>
        </div>

        <div className="py-4 space-y-3.5 text-sm text-neutral-300">
          {activePlatform === 'desktop' ? (
            <>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/5 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-white">1. Click Address Bar Icon</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Click the download icon (monitor with arrow or ⊕) on the far right of your browser's address bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/5 shrink-0">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-white">2. Or Use Browser Menu</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Open your browser menu (⋮ or ⋯), select &quot;Save & share&quot; (or &quot;Apps&quot;) and click &quot;Install Celestial Music&quot;.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-neutral-400">
                💻 <strong className="text-neutral-200">Desktop Integration:</strong> Opens in a dedicated borderless window, supports hardware media keys, and runs on startup if configured.
              </div>
            </>
          ) : activePlatform === 'ios' ? (
            <>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/5 shrink-0">
                  <Share className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-white">1. Tap the Share icon</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Tap the square Share icon with the upward arrow in your Safari toolbar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/5 shrink-0">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-white">2. Select &apos;Add to Home Screen&apos;</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Scroll down in the Safari menu and tap &quot;Add to Home Screen&quot;, then tap &quot;Add&quot;.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-neutral-400">
                🚀 <strong className="text-neutral-200">Full App Experience:</strong> Runs full-screen without address bars, with lock-screen music playback and offline caching.
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/5 shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-white">1. Tap &apos;Install App&apos;</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Tap the Install button in the header or in your Chrome browser menu (three dots ⋮).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/5 text-white border border-white/5 shrink-0">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-white">2. Confirm Installation</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Tap &quot;Install&quot; to add Celestial Music directly to your app drawer and home screen.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-neutral-400">
                ⚡ <strong className="text-neutral-200">Native WebAPK:</strong> Integrates with Android media player notifications, lock screen, and Bluetooth controls.
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-2xl bg-white hover:bg-neutral-200 font-bold text-sm transition active:scale-98 text-black shadow-lg"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
