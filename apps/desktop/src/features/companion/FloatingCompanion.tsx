import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NeroCharacter } from './components/NeroCharacter';
import { useCompanionStore } from '../../stores/companionStore';

export const FloatingCompanion: React.FC = () => {
  const { petCompanion, triggerClickReaction } = useCompanionStore();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  const handleClose = () => {
    if ((window.electronAPI as any)?.companion?.close) {
      (window.electronAPI as any).companion.close();
    } else {
      window.close();
    }
  };

  const handleOpenMain = () => {
    if ((window.electronAPI as any)?.companion?.openMainWindow) {
      (window.electronAPI as any).companion.openMainWindow();
    } else {
      window.open('#/', '_blank');
    }
  };

  const handleToggleAlwaysOnTop = () => {
    const nextState = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextState);
    if ((window.electronAPI as any)?.companion?.setAlwaysOnTop) {
      (window.electronAPI as any).companion.setAlwaysOnTop(nextState);
    }
  };

  return (
    <div
      className="w-full h-full select-none flex flex-col justify-between items-center p-3 relative overflow-hidden"
      style={{
        background: 'rgba(10, 15, 26, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 16px rgba(0, 212, 255, 0.1)',
      }}
    >
      {/* Top Drag Bar & Controls */}
      <div className="w-full flex items-center justify-between px-2 pt-1 window-drag">
        {/* Drag handle pill */}
        <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
          <div className="w-1.5 h-1.5 rounded-full bg-nero-cyan animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-nero-cyan font-bold">
            NERO
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 window-no-drag">
          <button
            onClick={handleToggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Always on Top (Active)' : 'Pin to Top'}
            className={`p-1 rounded text-xs transition-colors ${
              isAlwaysOnTop ? 'text-nero-cyan bg-nero-cyan/15' : 'text-nero-muted hover:text-nero-text'
            }`}
          >
            📌
          </button>
          <button
            onClick={handleOpenMain}
            title="Open Main NERO Dashboard"
            className="p-1 rounded text-xs text-nero-muted hover:text-nero-cyan hover:bg-white/5 transition-colors"
          >
            🗔
          </button>
          <button
            onClick={handleClose}
            title="Hide Companion"
            className="p-1 rounded text-xs text-nero-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Character Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative w-full window-no-drag">
        <NeroCharacter size={200} compact={true} showAura={true} />
      </div>

      {/* Quick Action Pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex items-center justify-center gap-2 pb-1 window-no-drag"
      >
        <button
          onClick={petCompanion}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white/[0.06] hover:bg-red-500/20 text-nero-text hover:text-red-300 border border-white/10 transition-all active:scale-95 shadow-sm"
          title="Pet NERO"
        >
          <span>❤️</span>
          <span className="text-[11px] font-medium">Pet</span>
        </button>
        <button
          onClick={triggerClickReaction}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white/[0.06] hover:bg-nero-cyan/20 text-nero-text hover:text-nero-cyan border border-white/10 transition-all active:scale-95 shadow-sm"
          title="Poke NERO"
        >
          <span>👉</span>
          <span className="text-[11px] font-medium">Poke</span>
        </button>
        <button
          onClick={handleOpenMain}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-nero-cyan/15 hover:bg-nero-cyan/25 text-nero-cyan border border-nero-cyan/30 transition-all active:scale-95 shadow-sm font-medium"
          title="Open Chat in Main App"
        >
          <span>💬</span>
          <span className="text-[11px]">Chat</span>
        </button>
      </motion.div>
    </div>
  );
};
