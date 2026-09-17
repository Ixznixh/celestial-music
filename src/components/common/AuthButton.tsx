import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, User as UserIcon, CloudCheck, Loader2, Sparkles, Youtube, Settings } from 'lucide-react';
import { User } from 'firebase/auth';
import { subscribeToAuth, signInWithGoogle, signOutUser } from '../../lib/firebase';

interface AuthButtonProps {
  onOpenAccountModal?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ onOpenAccountModal }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
      if (onOpenAccountModal) {
        onOpenAccountModal();
      }
    } catch (err: any) {
      console.error('Sign-In Error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setDropdownOpen(false);
      await signOutUser();
    } catch (err: any) {
      console.error('Sign-Out Error:', err);
    }
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSignIn}
        disabled={signingIn}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
        title="Sign in with Google Account to integrate YouTube liked songs & cloud sync"
      >
        {signingIn ? (
          <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span className="hidden sm:inline">Sign In</span>
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (onOpenAccountModal) {
            onOpenAccountModal();
          } else {
            setDropdownOpen(!dropdownOpen);
          }
        }}
        className="flex items-center gap-2 p-1 pr-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
        title="Open Account & Demus YouTube Sync Hub"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-6 h-6 rounded-full object-cover border border-white/20"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-rose-500/30 border border-rose-500/40 flex items-center justify-center text-[10px] text-rose-300 font-bold">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
        <span className="hidden sm:inline max-w-[90px] truncate">
          {user.displayName?.split(' ')[0] || 'Account'}
        </span>
        <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
      </motion.button>

      <AnimatePresence>
        {dropdownOpen && !onOpenAccountModal && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 z-50 w-64 p-4 rounded-2xl bg-neutral-900/95 border border-white/15 backdrop-blur-xl shadow-2xl text-left"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-sm text-rose-300 font-bold">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {user.displayName || 'Celestial User'}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="py-2.5 px-1 space-y-2 border-b border-white/10 my-2 text-xs text-neutral-300">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CloudCheck className="w-3.5 h-3.5" />
                    Firestore Cloud Sync
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Your playlists, favorites, and search history are automatically synchronized to Google Firestore.
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

