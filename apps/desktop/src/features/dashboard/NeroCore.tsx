import { motion, useAnimationControls } from 'framer-motion';
import { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { AIStateBadge } from '../../components/ui/StatusIndicator';
import type { AIState } from '../../types';

interface OrbConfig {
  color: string;
  glowColor: string;
  pulseSpeed: number;
  ringSpeed: number;
  scale: number;
  label: string;
}

const STATE_CONFIG: Record<AIState, OrbConfig> = {
  idle: {
    color: '#00d4ff',
    glowColor: 'rgba(0,212,255,0.3)',
    pulseSpeed: 3,
    ringSpeed: 8,
    scale: 1,
    label: 'Standing by',
  },
  listening: {
    color: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.4)',
    pulseSpeed: 1.2,
    ringSpeed: 4,
    scale: 1.05,
    label: 'Listening to you...',
  },
  thinking: {
    color: '#00d4ff',
    glowColor: 'rgba(0,212,255,0.5)',
    pulseSpeed: 0.8,
    ringSpeed: 1.5,
    scale: 1.08,
    label: 'Processing...',
  },
  speaking: {
    color: '#10b981',
    glowColor: 'rgba(16,185,129,0.4)',
    pulseSpeed: 1,
    ringSpeed: 3,
    scale: 1.06,
    label: 'Responding...',
  },
  executing: {
    color: '#2563eb',
    glowColor: 'rgba(37,99,235,0.4)',
    pulseSpeed: 0.6,
    ringSpeed: 1,
    scale: 1.04,
    label: 'Executing task...',
  },
  error: {
    color: '#ef4444',
    glowColor: 'rgba(239,68,68,0.4)',
    pulseSpeed: 0.4,
    ringSpeed: 6,
    scale: 0.95,
    label: 'An error occurred',
  },
};

function RippleRing({ delay, state }: { delay: number; state: AIState }) {
  const config = STATE_CONFIG[state];
  const isAnimating = state === 'listening' || state === 'thinking' || state === 'speaking';

  if (!isAnimating) return null;

  return (
    <motion.div
      className="absolute rounded-full border"
      style={{
        borderColor: config.color,
        width: 180,
        height: 180,
        top: 0,
        left: 0,
      }}
      initial={{ opacity: 0.6, scale: 1 }}
      animate={{ opacity: 0, scale: 1.8 }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

export function NeroCore() {
  const { aiState } = useAppStore();
  const config = STATE_CONFIG[aiState];
  const orbControls = useAnimationControls();

  useEffect(() => {
    if (aiState === 'error') {
      void orbControls.start({
        x: [0, -4, 4, -4, 4, 0],
        transition: { duration: 0.4, repeat: 2 },
      });
    } else {
      void orbControls.start({ x: 0 });
    }
  }, [aiState, orbControls]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Orb container */}
      <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
        {/* Ripple rings for active states */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: 180, height: 180 }}>
            <RippleRing delay={0} state={aiState} />
            <RippleRing delay={0.7} state={aiState} />
            <RippleRing delay={1.4} state={aiState} />
          </div>
        </div>

        {/* Outer rotating ring */}
        <motion.div
          className="absolute rounded-full border"
          style={{
            width: 190,
            height: 190,
            borderColor: config.color,
            borderWidth: 1,
            opacity: 0.3,
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: config.ringSpeed,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {/* Ring accent dot */}
          <div
            className="absolute w-2 h-2 rounded-full top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ background: config.color }}
          />
        </motion.div>

        {/* Inner counter-rotating ring */}
        <motion.div
          className="absolute rounded-full border"
          style={{
            width: 160,
            height: 160,
            borderColor: config.color,
            borderWidth: 1,
            opacity: 0.15,
            borderStyle: 'dashed',
          }}
          animate={{ rotate: -360 }}
          transition={{
            duration: config.ringSpeed * 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Core orb */}
        <motion.div
          animate={orbControls}
        >
          <motion.div
            className="relative rounded-full flex items-center justify-center cursor-pointer"
            style={{
              width: 130,
              height: 130,
              background: `radial-gradient(circle at 35% 35%, ${config.color}33 0%, ${config.color}11 50%, transparent 70%)`,
              border: `1px solid ${config.color}66`,
              boxShadow: `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColor.replace('0.', '0.0')}, inset 0 0 30px ${config.color}11`,
            }}
            animate={{
              scale: [config.scale, config.scale * 1.04, config.scale],
              boxShadow: [
                `0 0 40px ${config.glowColor}, inset 0 0 30px ${config.color}11`,
                `0 0 60px ${config.glowColor}, inset 0 0 40px ${config.color}22`,
                `0 0 40px ${config.glowColor}, inset 0 0 30px ${config.color}11`,
              ],
            }}
            transition={{
              duration: config.pulseSpeed,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Inner glow core */}
            <motion.div
              className="rounded-full"
              style={{
                width: 60,
                height: 60,
                background: `radial-gradient(circle, ${config.color}66 0%, transparent 70%)`,
              }}
              animate={{
                scale: aiState === 'thinking' ? [1, 1.3, 1] : [1, 1.1, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: config.pulseSpeed * 0.7,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Executing spinner overlay */}
            {aiState === 'executing' && (
              <motion.div
                className="absolute rounded-full border-t-2 border-r-2"
                style={{
                  width: 110,
                  height: 110,
                  borderColor: config.color,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* State badge */}
      <div className="flex flex-col items-center gap-2">
        <AIStateBadge state={aiState} />
        <motion.p
          key={aiState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-nero-muted text-xs"
        >
          {config.label}
        </motion.p>
      </div>
    </div>
  );
}
