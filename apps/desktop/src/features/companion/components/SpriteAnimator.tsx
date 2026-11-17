import React, { useState } from 'react';
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
  onAnimationEnd,
}) => {
  const [sheetFailed, setSheetFailed] = useState(false);
  const config = ANIMATION_CONFIGS[state] || ANIMATION_CONFIGS.idle;

  const durationSec = config.frameCount / Math.max(1, config.fps);
  const iterationCount = config.loop ? 'infinite' : '1';
  const fillMode = config.loop ? 'none' : 'forwards';

  return (
    <div
      className={`relative select-none overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      {!sheetFailed ? (
        <img
          key={`${state}-${config.sheetPath}`}
          src={config.sheetPath}
          alt={`NERO ${state}`}
          draggable={false}
          onError={() => setSheetFailed(true)}
          onAnimationEnd={onAnimationEnd}
          className="nero-sprite-animate pointer-events-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${config.frameCount * 100}%`,
            maxWidth: 'none',
            display: 'block',
            animationDuration: `${durationSec}s`,
            animationIterationCount: iterationCount,
            animationFillMode: fillMode,
            transformOrigin: 'top left',
          }}
        />
      ) : (
        <img
          key={`frame-${state}-${config.framePath}`}
          src={config.framePath}
          alt={`NERO ${state}`}
          draggable={false}
          className="w-full h-full object-contain pointer-events-none"
        />
      )}
    </div>
  );
};
