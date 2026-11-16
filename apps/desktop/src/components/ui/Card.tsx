import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
  animate?: boolean;
}

export function Card({ children, className = '', glow = false, onClick, animate = true }: CardProps) {
  if (animate) {
    return (
      <motion.div
        className={`glass rounded-xl p-4 ${glow ? 'cyan-glow-sm' : ''} ${onClick ? 'cursor-pointer glass-hover' : ''} ${className}`}
        onClick={onClick}
        whileHover={onClick ? { scale: 1.01 } : undefined}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={`glass rounded-xl p-4 ${glow ? 'cyan-glow-sm' : ''} ${onClick ? 'cursor-pointer glass-hover' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
