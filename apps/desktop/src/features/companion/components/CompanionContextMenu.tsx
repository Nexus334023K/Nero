import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCompanionStore } from '../../../stores/companionStore';

export interface CompanionContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  isAlwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  onClose: () => void;
}

export const CompanionContextMenu: React.FC<CompanionContextMenuProps> = ({
  isOpen,
  position,
  isAlwaysOnTop,
  onToggleAlwaysOnTop,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { petCompanion, triggerClickReaction } = useCompanionStore();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenChat = () => {
    onClose();
    if (window.electronAPI?.companion?.openMainWindow) {
      window.electronAPI.companion.openMainWindow('/chat');
    } else {
      window.open('#/chat', '_blank');
    }
  };

  const handleOpenSettings = () => {
    onClose();
    if (window.electronAPI?.companion?.openSettings) {
      window.electronAPI.companion.openSettings();
    } else {
      window.open('#/settings', '_blank');
    }
  };

  const handleHide = () => {
    onClose();
    if (window.electronAPI?.companion?.close) {
      window.electronAPI.companion.close();
    } else {
      window.close();
    }
  };

  const handlePet = () => {
    onClose();
    petCompanion();
  };

  const handlePoke = () => {
    onClose();
    triggerClickReaction();
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-50 w-52 rounded-xl text-nero-text font-sans p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-nero-cyan/30 text-xs"
        style={{
          top: Math.max(8, Math.min(window.innerHeight - 240, position.y)),
          left: Math.max(8, Math.min(window.innerWidth - 220, position.x)),
          background: 'rgba(10, 15, 26, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-nero-cyan animate-pulse" />
            <span className="font-mono text-[10px] tracking-wider uppercase text-nero-cyan font-bold">
              NERO Companion
            </span>
          </div>
          <span className="text-[10px] text-nero-muted">Desktop Pet</span>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleOpenChat}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-nero-cyan/15 hover:text-nero-cyan transition-colors"
          >
            <span>💬</span>
            <span className="font-medium">Open Chat</span>
          </button>

          <button
            onClick={handlePet}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-red-500/15 hover:text-red-300 transition-colors"
          >
            <span>❤️</span>
            <span>Pet NERO</span>
          </button>

          <button
            onClick={handlePoke}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-nero-cyan/15 hover:text-nero-cyan transition-colors"
          >
            <span>👉</span>
            <span>Poke NERO</span>
          </button>

          <div className="my-1 border-t border-white/10" />

          <button
            onClick={onToggleAlwaysOnTop}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>📌</span>
              <span>Always on Top</span>
            </div>
            <span className={`text-[10px] font-mono ${isAlwaysOnTop ? 'text-nero-cyan' : 'text-nero-muted'}`}>
              {isAlwaysOnTop ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={handleOpenSettings}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/5 transition-colors"
          >
            <span>⚙️</span>
            <span>Open Audio & Settings</span>
          </button>

          <div className="my-1 border-t border-white/10" />

          <button
            onClick={handleHide}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-nero-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span>✕</span>
            <span>Hide Companion</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
