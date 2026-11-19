import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { useCompanionStore } from '../../stores/companionStore';
import { SpriteAnimator } from './components/SpriteAnimator';
import { CompanionContextMenu } from './components/CompanionContextMenu';
import type { AnimationState } from './types';

const MOTION_PROFILES: Record<
  AnimationState,
  {
    animate: any;
    transition: any;
  }
> = {
  talking: {
    animate: {
      y: [0, -5, -1, -6, -2, 0],
      rotate: [0, -1.8, 1.4, -1.2, 1, 0],
      scale: [1, 1.035, 0.99, 1.03, 1],
      filter: [
        'drop-shadow(0 4px 14px rgba(0, 212, 255, 0.35))',
        'drop-shadow(0 4px 22px rgba(0, 212, 255, 0.7))',
        'drop-shadow(0 4px 14px rgba(0, 212, 255, 0.35))',
      ],
    },
    transition: {
      y: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' },
      scale: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' },
      filter: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  listening: {
    animate: {
      y: [0, -3, 0],
      scale: [1, 1.025, 1],
      filter: [
        'drop-shadow(0 4px 14px rgba(0, 212, 255, 0.4))',
        'drop-shadow(0 4px 24px rgba(0, 212, 255, 0.8))',
        'drop-shadow(0 4px 14px rgba(0, 212, 255, 0.4))',
      ],
    },
    transition: {
      y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
      scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
      filter: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  thinking: {
    animate: {
      y: [0, -4, 0],
      rotate: [0, 3, 1.5, 3.5, 0],
      filter: [
        'drop-shadow(0 4px 12px rgba(0, 180, 255, 0.3))',
        'drop-shadow(0 4px 20px rgba(0, 180, 255, 0.6))',
        'drop-shadow(0 4px 12px rgba(0, 180, 255, 0.3))',
      ],
    },
    transition: {
      y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
      filter: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  happy: {
    animate: {
      y: [0, -12, 0, -8, 0],
      scale: [1, 1.06, 1, 1.03, 1],
      rotate: [0, -2, 2, 0],
      filter: 'drop-shadow(0 4px 22px rgba(0, 212, 255, 0.6))',
    },
    transition: {
      y: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' },
      scale: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  surprised: {
    animate: {
      y: [0, -10, 2, -2, 0],
      scale: [1, 1.08, 0.96, 1],
      rotate: [0, -3, 3, 0],
      filter: 'drop-shadow(0 4px 20px rgba(239, 68, 68, 0.5))',
    },
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatDelay: 1.5,
      ease: 'easeOut',
    },
  },
  clicked: {
    animate: {
      scale: [1, 0.88, 1.08, 0.98, 1],
      y: [0, 6, -7, 0],
      rotate: [0, -5, 4, 0],
      filter: 'drop-shadow(0 4px 20px rgba(0, 212, 255, 0.7))',
    },
    transition: {
      duration: 0.35,
      ease: 'easeOut',
    },
  },
  sleeping: {
    animate: {
      y: [0, 3, 0],
      scale: [1, 1.015, 1],
      filter: 'drop-shadow(0 4px 10px rgba(100, 116, 139, 0.3))',
    },
    transition: {
      y: { duration: 4.0, repeat: Infinity, ease: 'easeInOut' },
      scale: { duration: 4.0, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  idle: {
    animate: {
      y: [0, -5, 0],
      rotate: [0, -0.8, 0.8, 0],
      scale: [1, 1.01, 1],
      filter: 'drop-shadow(0 4px 14px rgba(0, 212, 255, 0.28))',
    },
    transition: {
      y: { duration: 3.0, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 3.0, repeat: Infinity, ease: 'easeInOut' },
      scale: { duration: 3.0, repeat: Infinity, ease: 'easeInOut' },
    },
  },
};

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
        animate={MOTION_PROFILES[currentAnimation]?.animate || MOTION_PROFILES.idle.animate}
        transition={MOTION_PROFILES[currentAnimation]?.transition || MOTION_PROFILES.idle.transition}
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
