import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/appStore';
import { useCompanionStore } from '../../../stores/companionStore';
import { SpriteAnimator } from './SpriteAnimator';
import { CompanionBubble } from './CompanionBubble';
import { CompanionMenu } from './CompanionMenu';
import type { AnimationState } from '../types';

export interface NeroCharacterProps {
  size?: number;
  compact?: boolean;
  className?: string;
  showAura?: boolean;
}

export const NeroCharacter: React.FC<NeroCharacterProps> = ({
  size = 256,
  compact = false,
  className = '',
  showAura = true,
}) => {
  const navigate = useNavigate();
  const characterRef = useRef<HTMLDivElement>(null);

  // App & Companion states
  const { aiState } = useAppStore();
  const {
    overrideAnimation,
    stats,
    triggerClickReaction,
    setMenuOpen,
    setMenuPosition,
  } = useCompanionStore();

  // Mouse hover tracking
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!characterRef.current) return;
    const rect = characterRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);

    // Subtle 3D tilt tracking (clamped to max 7 degrees)
    setRotate({
      x: Math.max(-7, Math.min(7, -deltaY * 6)),
      y: Math.max(-7, Math.min(7, deltaX * 7)),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotate({ x: 0, y: 0 });
  }, []);

  // Compute active animation based on AI state & companion mood & overrides
  const currentAnimation: AnimationState = useMemo(() => {
    // 1. Temporary override (e.g. clicked, pet) takes priority
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
        // When AI is idle, reflect pet mood
        if (stats.mood === 'sleepy' || stats.energy < 20) return 'sleeping';
        if (stats.mood === 'happy') return 'happy';
        return 'idle';
    }
  }, [overrideAnimation, aiState, stats.mood, stats.energy]);

  // Click handler
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickReaction();
  };

  // Double click handler -> Chat
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/chat');
  };

  // Right click handler -> Context Menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  return (
    <div
      ref={characterRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`relative flex flex-col items-center justify-center cursor-pointer select-none group ${className}`}
      style={{
        width: size,
        minHeight: size + 40,
        perspective: 800,
      }}
      title="NERO — Click to interact, double-click for chat, right-click for menu"
    >
      {/* Speech Bubble floating above character head */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-full flex justify-center z-20">
        <CompanionBubble compact={compact} />
      </div>

      {/* Cybernetic Aura / Floor Ring */}
      {showAura && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none rounded-full"
          style={{
            width: size * 0.75,
            height: size * 0.22,
            background:
              aiState === 'error'
                ? 'radial-gradient(ellipse at center, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.05) 50%, transparent 80%)'
                : aiState === 'speaking'
                ? 'radial-gradient(ellipse at center, rgba(16,185,129,0.35) 0%, rgba(0,212,255,0.15) 50%, transparent 80%)'
                : 'radial-gradient(ellipse at center, rgba(0,212,255,0.35) 0%, rgba(0,212,255,0.08) 50%, transparent 80%)',
            filter: 'blur(8px)',
          }}
        />
      )}

      {/* Futuristic platform ring */}
      {showAura && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none rounded-full border border-nero-cyan/20 border-dashed"
          style={{
            width: size * 0.65,
            height: size * 0.18,
          }}
        />
      )}

      {/* Character Sprite Container with 3D cursor tilt & breathing bounce */}
      <motion.div
        animate={{
          rotateX: rotate.x,
          rotateY: rotate.y,
          y: currentAnimation === 'sleeping' ? [0, 1, 0] : [0, -4, 0],
          scale: currentAnimation === 'clicked' ? [1, 0.95, 1.04, 1] : 1,
        }}
        transition={{
          y: {
            duration: currentAnimation === 'sleeping' ? 4 : 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          scale: { duration: 0.35 },
          rotateX: { type: 'spring', stiffness: 200, damping: 25 },
          rotateY: { type: 'spring', stiffness: 200, damping: 25 },
        }}
        className="relative z-10 flex items-center justify-center transition-transform"
      >
        <SpriteAnimator state={currentAnimation} size={size} />
      </motion.div>

      {/* Context Menu */}
      <CompanionMenu />
    </div>
  );
};
