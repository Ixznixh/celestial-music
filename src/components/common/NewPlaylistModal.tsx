import React, { useState } from 'react';
import { X, Music2 } from 'lucide-react';

interface NewPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, description?: string) => void;
}

export const NewPlaylistModal: React.FC<NewPlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), description.trim());
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h3 className="text-base font-semibold">New Playlist</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="w-24 h-24 mx-auto rounded-2xl bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-rose-400 shadow-inner">
            <Music2 className="w-10 h-10" />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Playlist Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="My Favorite Mix"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-neutral-800/90 border border-neutral-700/80 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Late night songs, summer vibes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700/80 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-sm resize-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 font-medium text-sm text-neutral-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 font-semibold text-sm text-white transition shadow-lg shadow-rose-900/30"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
