import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCompanionStore } from '../../../stores/companionStore';
import type { CompanionMood } from '../types';

export interface CompanionMenuProps {
  onClose?: () => void;
}

const MOODS: { id: CompanionMood; label: string; icon: string }[] = [
  { id: 'playful', label: 'Playful', icon: '✨' },
  { id: 'happy', label: 'Happy', icon: '😄' },
  { id: 'curious', label: 'Curious', icon: '🔍' },
  { id: 'sleepy', label: 'Sleepy', icon: '💤' },
  { id: 'focused', label: 'Focused', icon: '⚡' },
];

export const CompanionMenu: React.FC<CompanionMenuProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    menuOpen,
    setMenuOpen,
    menuPosition,
    stats,
    setMood,
    petCompanion,
    triggerClickReaction,
  } = useCompanionStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        onClose?.();
      }
    };

    if (menuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen, setMenuOpen, onClose]);

  const handleOpenFloating = () => {
    setMenuOpen(false);
    if ((window.electronAPI as any)?.companion?.toggle) {
      (window.electronAPI as any).companion.toggle();
    } else {
      // In web dev mode fallback, navigate or open new window
      window.open('#/companion', '_blank', 'width=320,height=440');
    }
  };

  if (!menuOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 w-64 rounded-xl glass border border-nero-cyan/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-3 text-nero-text font-sans"
        style={{
          top: Math.min(window.innerHeight - 340, Math.max(16, menuPosition.y)),
          left: Math.min(window.innerWidth - 270, Math.max(16, menuPosition.x)),
          background: 'rgba(10, 15, 26, 0.94)',
          backdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Stats */}
        <div className="pb-2 mb-2 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-nero-cyan animate-pulse" />
            <span className="font-semibold text-xs tracking-wider uppercase text-nero-cyan">NERO Companion</span>
          </div>
          <span className="text-[10px] text-nero-muted font-mono">Lvl {Math.floor(stats.affection / 20) + 1}</span>
        </div>

        {/* Pet Stats preview */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-white/[0.03] p-2 rounded-lg border border-white/5 text-[11px]">
          <div>
            <span className="text-nero-muted">Affection</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-red-400">❤️</span>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-red-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${stats.affection}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-nero-muted">{stats.affection}%</span>
            </div>
          </div>
          <div>
            <span className="text-nero-muted">Energy</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-amber-400">⚡</span>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${stats.energy}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-nero-muted">{stats.energy}%</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-1 mb-3">
          <button
            onClick={() => {
              setMenuOpen(false);
              petCompanion();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-nero-cyan/15 hover:text-nero-cyan transition-colors text-left"
          >
            <span>❤️</span> Pet NERO
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              triggerClickReaction();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-nero-cyan/15 hover:text-nero-cyan transition-colors text-left"
          >
            <span>👉</span> Poke NERO
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate('/chat');
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors text-left"
          >
            <span>💬</span> Open Chat
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate('/voice');
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors text-left"
          >
            <span>🎙️</span> Voice Mode
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate('/settings');
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors text-left"
          >
            <span>⚙️</span> Audio & Settings
          </button>
          <button
            onClick={handleOpenFloating}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-nero-cyan/20 text-nero-cyan transition-colors text-left font-medium"
          >
            <span>🪟</span> Pop Out Desktop Companion
          </button>
        </div>

        {/* Mood Selector */}
        <div className="pt-2 border-t border-white/10">
          <span className="text-[10px] uppercase font-mono text-nero-muted block mb-1.5">Mood</span>
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMood(m.id)}
                title={m.label}
                className={`flex-1 py-1 rounded text-xs text-center transition-all ${
                  stats.mood === m.id
                    ? 'bg-nero-cyan/20 border border-nero-cyan/50 text-nero-cyan scale-105'
                    : 'bg-white/5 hover:bg-white/10 text-nero-muted hover:text-nero-text'
                }`}
              >
                {m.icon}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
