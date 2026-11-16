import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { NeroCore } from './NeroCore';
import { SystemStatus } from './SystemStatus';
import { Button } from '../../components/ui/Button';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-mono uppercase tracking-widest text-nero-muted">Quick Actions</h3>
      <Button
        variant="primary"
        onClick={() => navigate('/chat')}
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
      >
        Start Chat
      </Button>
      <Button
        variant="secondary"
        onClick={() => navigate('/voice')}
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        }
      >
        Voice Mode
      </Button>
      <Button
        variant="ghost"
        onClick={() => navigate('/settings')}
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        }
      >
        Settings
      </Button>
    </div>
  );
}

export function Dashboard() {
  return (
    <div className="h-full w-full flex flex-col overflow-auto p-6" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f1a 100%)' }}>
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-nero-text">
          {getGreeting()},{' '}
          <span className="text-nero-cyan">Nexus</span>
        </h1>
        <p className="text-nero-muted text-sm mt-1">Your AI companion is ready.</p>
      </motion.div>

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-[220px_1fr_220px] gap-6 min-h-0">
        {/* Left: System Status */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4"
        >
          <SystemStatus />

          {/* Backend URL info */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-nero-muted mb-3">Connection</h3>
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-xs text-nero-muted">Backend</p>
                <p className="text-xs font-mono text-nero-text">localhost:8765</p>
              </div>
              <div>
                <p className="text-xs text-nero-muted">WebSocket</p>
                <p className="text-xs font-mono text-nero-text">ws://localhost:8765/ws</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Center: NERO Core orb */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
          className="flex items-center justify-center"
        >
          <NeroCore />
        </motion.div>

        {/* Right: Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4"
        >
          <QuickActions />

          {/* Recent activity placeholder */}
          <div className="glass rounded-xl p-4 flex-1">
            <h3 className="text-xs font-mono uppercase tracking-widest text-nero-muted mb-3">Recent</h3>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-nero-muted text-center py-4">No recent activity</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
