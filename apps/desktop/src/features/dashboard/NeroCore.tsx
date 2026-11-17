import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { AIStateBadge } from '../../components/ui/StatusIndicator';
import { NeroCharacter } from '../companion/components/NeroCharacter';
import type { AIState } from '../../types';

const STATE_LABELS: Record<AIState, string> = {
  idle: 'Standing by — ready to assist',
  listening: 'Listening to you...',
  thinking: 'Processing your thoughts...',
  speaking: 'Speaking...',
  executing: 'Executing task...',
  error: 'Something went wrong',
};

export const NeroCore: React.FC = () => {
  const { aiState } = useAppStore();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Living Anime Character */}
      <div className="relative flex items-center justify-center">
        <NeroCharacter size={240} showAura={true} />
      </div>

      {/* State badge & contextual status */}
      <div className="flex flex-col items-center gap-1.5 -mt-2">
        <AIStateBadge state={aiState} />
        <motion.p
          key={aiState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-nero-muted text-xs tracking-wide"
        >
          {STATE_LABELS[aiState]}
        </motion.p>
      </div>
    </div>
  );
};
