import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { useCompanionStore } from '../../stores/companionStore';
import { SpriteAnimator } from './components/SpriteAnimator';
import { CompanionContextMenu } from './components/CompanionContextMenu';
import type { AnimationState } from './types';

export const FloatingCompanion: React.FC = () => {
  const { aiState } = useAppStore();
  const {
    overrideAnimation,
    stats,
    bubble,
    dismissBubble,
    triggerClickReaction,
  } = useCompanionStore();

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{
    screenX: number;
    screenY: number;
    winX: number;
    winY: number;
    moved: boolean;
  } | null>(null);

  // Set transparent class on html and body on mount
  useEffect(() => {
    document.documentElement.classList.add('transparent-companion');
    document.body.classList.add('transparent-companion');

    return () => {
      document.documentElement.classList.remove('transparent-companion');
      document.body.classList.remove('transparent-companion');
    };
  }, []);

  // Auto-dismiss temporary speech bubbles after duration
  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => {
      dismissBubble();
    }, bubble.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [bubble, dismissBubble]);

  // Compute active animation based on AI state & companion mood & overrides
  const currentAnimation: AnimationState = useMemo(() => {
    // 1. Temporary pet reaction (click, pet) takes priority
    if (overrideAnimation) return overrideAnimation;

    // 2. Real AI activity states
    switch (aiState) {
      case 'listening':
        return 'listening';
      case 'thinking':
      case 'executing':
        return 'thinking';
      case 'speaking':
        return 'talking';
      case 'error':
        return 'surprised';
      case 'idle':
      default:
        if (stats.mood === 'sleepy' || stats.energy < 20) return 'sleeping';
        if (stats.mood === 'happy') return 'happy';
        return 'idle';
    }
  }, [overrideAnimation, aiState, stats.mood, stats.energy]);

  // Mouse click-through handling
  const handleMouseEnterInteractive = useCallback(() => {
    window.electronAPI?.companion?.setIgnoreMouseEvents(false);
  }, []);

  const handleMouseLeaveInteractive = useCallback(() => {
    if (!contextMenuPos) {
      window.electronAPI?.companion?.setIgnoreMouseEvents(true, true);
    }
  }, [contextMenuPos]);

  // Toggle always on top
  const handleToggleAlwaysOnTop = () => {
    const next = !isAlwaysOnTop;
    setIsAlwaysOnTop(next);
    window.electronAPI?.companion?.setAlwaysOnTop(next);
  };

  // Draggable & click interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click for drag and poke

    dragStartRef.current = {
      screenX: e.screenX,
      screenY: e.screenY,
      winX: window.screenX,
      winY: window.screenY,
      moved: false,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.screenX - dragStartRef.current.screenX;
      const dy = moveEvent.screenY - dragStartRef.current.screenY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragStartRef.current.moved = true;
        window.electronAPI?.companion?.move(
          dragStartRef.current.winX + dx,
          dragStartRef.current.winY + dy,
        );
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // If user released without dragging, execute clean single click reaction
      if (dragStartRef.current && !dragStartRef.current.moved) {
        triggerClickReaction();
      }
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Double click -> Open main chat
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.electronAPI?.companion?.openMainWindow) {
      window.electronAPI.companion.openMainWindow('/chat');
    } else {
      window.open('#/chat', '_blank');
    }
  };

  // Right click -> Open compact context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="w-screen h-screen select-none flex flex-col items-center justify-end p-2 relative overflow-visible"
      style={{
        background: 'transparent',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={handleMouseLeaveInteractive}
    >
      {/* Temporary Speech Bubble (appears only when NERO has something to say) */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.92 }}
            transition={{ type: 'spring', damping: 20, stiffness: 350 }}
            onMouseEnter={handleMouseEnterInteractive}
            onMouseLeave={handleMouseLeaveInteractive}
            onClick={(e) => {
              e.stopPropagation();
              dismissBubble();
            }}
            className="cursor-pointer mb-2 px-3.5 py-2 rounded-2xl text-xs max-w-[210px] text-center text-nero-text font-medium leading-snug shadow-[0_4px_20px_rgba(0,212,255,0.3)] border border-nero-cyan/40 relative z-40"
            style={{
              background: 'rgba(10, 15, 26, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            {bubble.text}
            {/* Downward pointing speech bubble tail */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '7px solid rgba(0, 212, 255, 0.7)',
              }}
            />
            <div
              className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '5px solid rgba(10, 15, 26, 0.95)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pure Character Sprite Container */}
      <motion.div
        onMouseEnter={handleMouseEnterInteractive}
        onMouseLeave={handleMouseLeaveInteractive}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className="relative cursor-grab active:cursor-grabbing z-30"
        style={{
          width: 220,
          height: 220,
        }}
        title="NERO — Drag to move, click to poke, double-click for chat, right-click for menu"
        animate={{
          y: currentAnimation === 'sleeping' ? [0, 1, 0] : [0, -3.5, 0],
          scale: currentAnimation === 'clicked' ? [1, 0.94, 1.05, 1] : 1,
        }}
        transition={{
          y: {
            duration: currentAnimation === 'sleeping' ? 4 : 3,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          scale: { duration: 0.3 },
        }}
      >
        <SpriteAnimator state={currentAnimation} size={220} />
      </motion.div>

      {/* Compact Context Menu */}
      <CompanionContextMenu
        isOpen={contextMenuPos !== null}
        position={contextMenuPos || { x: 0, y: 0 }}
        isAlwaysOnTop={isAlwaysOnTop}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        onClose={() => {
          setContextMenuPos(null);
          handleMouseLeaveInteractive();
        }}
      />
    </div>
  );
};
