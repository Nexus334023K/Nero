import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { ChatView } from './features/chat/ChatView';
import { VoiceView } from './features/voice/VoiceView';
import { MemoryView } from './features/memory/MemoryView';
import { AutomationsView } from './features/automations/AutomationsView';
import { ProductivityView } from './features/productivity/ProductivityView';
import { SettingsView } from './features/settings/SettingsView';
import { wsService } from './services/websocket';
import { api } from './services/api';
import { useAppStore } from './stores/appStore';

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
          <Route path="/memory" element={<MemoryView />} />
          <Route path="/automations" element={<AutomationsView />} />
          <Route path="/productivity" element={<ProductivityView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </HashRouter>
  );
}
