import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { ChatView } from './features/chat/ChatView';
import { VoiceView } from './features/voice/VoiceView';
import { MemoryView } from './features/memory/MemoryView';
import { AutomationsView } from './features/automations/AutomationsView';
import { ProductivityView } from './features/productivity/ProductivityView';
import { TasksView } from './features/tasks/TasksView';
import { SettingsView } from './features/settings/SettingsView';
import { FloatingCompanion } from './features/companion/FloatingCompanion';
import { wsService } from './services/websocket';
import { api } from './services/api';
import { useAppStore } from './stores/appStore';
import { useTaskStore } from './stores/taskStore';
import { useCompanionStore } from './stores/companionStore';

function NavigationSync() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.electronAPI?.onNavigation) {
      return window.electronAPI.onNavigation((route) => {
        navigate(route);
      });
    }
  }, [navigate]);
  return null;
}

export function App() {
  const { setBackendStatus, setBackendVersion, setLastHealthCheck } = useAppStore();

  useEffect(() => {
    // 1. Initialize WebSocket connection
    wsService.connect();

    // Listen for background task events
    wsService.on('task_event', (raw: unknown) => {
      const data = raw as { event?: string; task_id?: string; data?: any };
      if (data?.task_id && data?.event) {
        useTaskStore.getState().handleWebSocketEvent(data.event, data.task_id, data.data);
        if (data.event === 'step_started') {
          useCompanionStore
            .getState()
            .triggerBubble(`NERO task step ${data.data?.step_number || ''}: ${data.data?.title || 'Processing'}`, 3500, 'status');
        } else if (data.event === 'completed') {
          useCompanionStore
            .getState()
            .triggerBubble('Research report ready! Task finished.', 4000, 'status');
          useCompanionStore.getState().playOneShot('happy', 3000);
        }
      }
    });

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
      <NavigationSync />
      <Routes>
        <Route path="/companion" element={<FloatingCompanion />} />
        <Route
          path="/*"
          element={
            <MainLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/chat" element={<ChatView />} />
                <Route path="/voice" element={<VoiceView />} />
                <Route path="/memory" element={<MemoryView />} />
                <Route path="/automations" element={<AutomationsView />} />
                <Route path="/tasks" element={<TasksView />} />
                <Route path="/productivity" element={<ProductivityView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </MainLayout>
          }
        />
      </Routes>
    </HashRouter>
  );
}
