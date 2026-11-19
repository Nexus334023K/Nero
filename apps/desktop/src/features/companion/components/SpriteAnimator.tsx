import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AnimationState } from '../types';
import { ANIMATION_CONFIGS } from '../animations/animationConfig';

export interface SpriteAnimatorProps {
  state: AnimationState;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  onAnimationEnd?: () => void;
}

export const SpriteAnimator: React.FC<SpriteAnimatorProps> = ({
  state,
  size = 256,
  className = '',
  style = {},
}) => {
  const config = ANIMATION_CONFIGS[state] || ANIMATION_CONFIGS.idle;

  return (
    <div
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0.8, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0.8, scale: 0.96 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative w-full h-full flex items-center justify-center pointer-events-none"
        >
          {/* Main High-Resolution Character Pose */}
          <img
            src={config.framePath}
            alt={`NERO ${state}`}
            draggable={false}
            className="w-full h-full object-contain pointer-events-none select-none drop-shadow-md"
            style={{
              imageRendering: 'auto',
            }}
          />

          {/* State-Specific Dynamic Expression & Visual Overlays */}
          {state === 'talking' && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Sound ripple 1 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.7, x: 28, y: -18 }}
                animate={{ opacity: [0, 0.7, 0], scale: [0.7, 1.25, 1.5], x: [28, 42, 54] }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'easeOut' }}
                className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full border border-nero-cyan/60"
              />
              {/* Sound ripple 2 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6, x: 28, y: -18 }}
                animate={{ opacity: [0, 0.6, 0], scale: [0.6, 1.2, 1.45], x: [28, 40, 50] }}
                transition={{ duration: 0.85, delay: 0.4, repeat: Infinity, ease: 'easeOut' }}
                className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full border border-nero-cyan/40"
              />
            </div>
          )}

          {state === 'thinking' && (
            <div className="absolute top-3 right-6 pointer-events-none flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                  transition={{ duration: 1.2, delay: i * 0.25, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-nero-cyan shadow-[0_0_8px_rgba(0,212,255,0.8)] inline-block"
                />
              ))}
            </div>
          )}

          {state === 'listening' && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Left headphone pulse */}
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-[38%] left-[28%] w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-nero-cyan/20 border border-nero-cyan/70 shadow-[0_0_12px_rgba(0,212,255,0.7)]"
              />
              {/* Right headphone pulse */}
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-[38%] right-[28%] w-5 h-5 translate-x-1/2 -translate-y-1/2 rounded-full bg-nero-cyan/20 border border-nero-cyan/70 shadow-[0_0_12px_rgba(0,212,255,0.7)]"
              />
            </div>
          )}

          {state === 'happy' && (
            <div className="absolute inset-0 pointer-events-none">
              <motion.span
                animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.8], y: [-4, -16] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                className="absolute top-6 left-6 text-nero-cyan text-sm drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]"
              >
                ✦
              </motion.span>
              <motion.span
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 0.8], y: [-2, -18] }}
                transition={{ duration: 1.4, delay: 0.5, repeat: Infinity, ease: 'easeOut' }}
                className="absolute top-4 right-8 text-white text-xs drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              >
                ✧
              </motion.span>
            </div>
          )}

          {state === 'sleeping' && (
            <div className="absolute top-4 right-5 pointer-events-none">
              <motion.span
                animate={{ opacity: [0, 1, 0], y: [0, -18], x: [0, 8] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                className="text-xs font-mono font-bold text-nero-cyan/80 absolute select-none"
              >
                Zzz
              </motion.span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
