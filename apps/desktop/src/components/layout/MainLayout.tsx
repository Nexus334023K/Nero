import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

function TitleBar() {
  const handleMinimize = () => window.electronAPI?.window.minimize();
  const handleMaximize = () => window.electronAPI?.window.maximize();
  const handleClose = () => window.electronAPI?.window.close();

  return (
    <div
      className="titlebar-drag flex items-center justify-between h-9 px-4 shrink-0"
      style={{
        background: 'rgba(10,10,15,0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Left: app name (non-drag for text, but area is draggable) */}
      <div className="flex items-center gap-2 pointer-events-none select-none">
        <span className="text-nero-muted text-xs font-mono tracking-widest">NERO</span>
        <span className="text-nero-muted/40 text-xs">•</span>
        <span className="text-nero-muted/60 text-xs">AI Companion</span>
      </div>

      {/* Window controls — must NOT be draggable */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-7 h-7 rounded flex items-center justify-center text-nero-muted hover:text-nero-text hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor">
            <rect width="10" height="2" rx="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 rounded flex items-center justify-center text-nero-muted hover:text-nero-text hover:bg-white/10 transition-colors"
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="8" height="8" rx="1" />
          </svg>
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 rounded flex items-center justify-center text-nero-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: '#0a0a0f' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
