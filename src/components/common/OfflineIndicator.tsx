import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-neutral-900/95 border border-amber-500/30 px-3.5 py-1.5 text-xs font-medium text-amber-400 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>No Internet Connection</span>
    </div>
  );
};
