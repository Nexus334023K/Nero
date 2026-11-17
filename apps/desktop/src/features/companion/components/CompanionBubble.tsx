import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCompanionStore } from '../../../stores/companionStore';

export interface CompanionBubbleProps {
  compact?: boolean;
  className?: string;
}

export const CompanionBubble: React.FC<CompanionBubbleProps> = ({
  compact = false,
  className = '',
}) => {
  const { bubble, dismissBubble } = useCompanionStore();

  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => {
      dismissBubble();
    }, bubble.duration ?? 4000);

    return () => clearTimeout(timer);
  }, [bubble, dismissBubble]);

  return (
    <div className={`relative flex flex-col items-center pointer-events-none select-none z-30 ${className}`}>
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.92 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={(e) => {
              e.stopPropagation();
              dismissBubble();
            }}
            className={`pointer-events-auto cursor-pointer relative rounded-2xl glass border border-nero-cyan/40 shadow-lg text-nero-text flex items-center justify-center text-center ${
              compact
                ? 'px-3 py-2 text-xs max-w-[210px] shadow-[0_4px_16px_rgba(0,212,255,0.25)]'
                : 'px-5 py-3 text-sm max-w-[280px] shadow-[0_6px_24px_rgba(0,212,255,0.25)]'
            }`}
            style={{
              background: 'rgba(10, 15, 26, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <p className="leading-snug font-medium tracking-wide">
              {bubble.text}
            </p>

            {/* Bubble Tail pointing down */}
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '8px solid rgba(0, 212, 255, 0.7)',
              }}
            />
            <div
              className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '6px solid rgba(10, 15, 26, 0.95)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
