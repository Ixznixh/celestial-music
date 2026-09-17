import React from 'react';
import { WifiOff, ArrowDownCircle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useDownloads } from '../../hooks/useDownloads';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { isOfflineMode, downloadCount } = useDownloads();

  if (isOnline && !isOfflineMode) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-neutral-900/95 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-medium text-emerald-400 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
      {isOfflineMode ? (
        <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      )}
      <span>
        {isOfflineMode ? 'Offline Mode' : 'No Internet'} • {downloadCount} {downloadCount === 1 ? 'song' : 'songs'} ready
      </span>
    </div>
  );
};
