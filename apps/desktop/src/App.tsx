import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { ChatView } from './features/chat/ChatView';
import { VoiceView } from './features/voice/VoiceView';
import { SettingsView } from './features/settings/SettingsView';
import { wsService } from './services/websocket';
import { api } from './services/api';
import { useAppStore } from './stores/appStore';

function MemoryPlaceholder() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-nero-bg">
      <div className="w-16 h-16 rounded-2xl bg-nero-cyan/10 border border-nero-cyan/30 flex items-center justify-center mb-4 cyan-glow">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-nero-cyan">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-nero-text mb-2">Semantic & Epodic Memory</h2>
      <p className="text-sm text-nero-muted max-w-md">
        View vector database memories, conversation recall, and personalized user models stored securely on your local machine.
      </p>
      <span className="mt-4 px-3 py-1 text-xs font-mono text-nero-cyan bg-nero-cyan/10 border border-nero-cyan/30 rounded-full">
        Coming Soon
      </span>
    </div>
  );
}

export function App() {
  const { setBackendStatus, setBackendVersion, setLastHealthCheck } = useAppStore();

  useEffect(() => {
    // 1. Initialize WebSocket connection
    wsService.connect();

    // 2. Health check poller
    const checkHealth = async () => {
      try {
        const data = await api.health.get();
        setBackendStatus('connected');
        if (data.version) setBackendVersion(data.version);
        setLastHealthCheck(new Date().toISOString());
      } catch {
        setBackendStatus('disconnected');
      }
    };

    void checkHealth();
    const interval = setInterval(() => {
      void checkHealth();
    }, 10000);

    return () => {
      clearInterval(interval);
      wsService.disconnect();
    };
  }, [setBackendStatus, setBackendVersion, setLastHealthCheck]);

  return (
    <HashRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatView />} />
          <Route path="/voice" element={<VoiceView />} />
          <Route path="/memory" element={<MemoryPlaceholder />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </HashRouter>
  );
}
